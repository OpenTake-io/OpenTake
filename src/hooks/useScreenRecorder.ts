import { useState, useRef, useEffect } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";

type UseScreenRecorderReturn = {
  recording: boolean;
  toggleRecording: () => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const selectedSource = await window.electronAPI.getSelectedSource();
      
      if (!selectedSource) {
        alert("Please select a source to record");
        return;
      }

      await window.electronAPI.startMouseTracking();

      const stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSource.id,
          },
        },
      });
      streamRef.current = stream;
      
      if (!streamRef.current) {
        throw new Error("Failed to get media stream");
      }
      
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const width = settings.width || 1920;
      const height = settings.height || 1080;
      const totalPixels = width * height;
      
      let bitrate: number;
      if (totalPixels <= 1920 * 1080) {
        bitrate = 150_000_000;
      } else if (totalPixels <= 2560 * 1440) {
        bitrate = 250_000_000;
      } else {
        bitrate = 400_000_000;
      }
      
      chunksRef.current = [];
      const mimeType = "video/webm;codecs=vp9";
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: bitrate,
      });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        streamRef.current = null;
        
        if (chunksRef.current.length === 0) return;
        
        const duration = Date.now() - startTimeRef.current;
        const buggyBlob = new Blob(chunksRef.current, { type: mimeType });
        const timestamp = Date.now();
        const videoFileName = `recording-${timestamp}.webm`;
        const trackingFileName = `recording-${timestamp}_tracking.json`;
        
        try {
          const videoBlob = await fixWebmDuration(buggyBlob, duration);
          const arrayBuffer = await videoBlob.arrayBuffer();
          
          const videoResult = await window.electronAPI.storeRecordedVideo(
            arrayBuffer,
            videoFileName
          );
          
          if (!videoResult.success) {
            console.error('Failed to store video:', videoResult.message);
            return;
          }
          
          const trackingResult = await window.electronAPI.storeMouseTrackingData(trackingFileName);
          
          if (!trackingResult.success) {
            console.warn('Failed to store mouse tracking:', trackingResult.message);
          }
          
          await window.electronAPI.switchToEditor();
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };
      
      recorder.onerror = () => {
        setRecording(false);
      };
      
      recorder.start(1000);
      startTimeRef.current = Date.now();
      setRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      mediaRecorderRef.current.stop();
      setRecording(false);
      window.electronAPI.stopMouseTracking();
    }
  };

  const toggleRecording = () => {
    if (!recording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return { recording, toggleRecording };
}
