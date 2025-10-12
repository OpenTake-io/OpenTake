import { useScreenRecorder } from "./hooks/useScreenRecorder";
import { Button } from "@/components/ui/button";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdMonitor } from "react-icons/md";

export default function App() {
  const { recording, toggleRecording } = useScreenRecorder();

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent">
      <div className="flex items-center gap-3 backdrop-blur-lg bg-white/10 rounded-full px-4 py-2 shadow-2xl border border-white/30">
        <Button
          variant="link"
          size="sm"
          className="gap-2 text-white bg-transparent hover:bg-transparent px-3"
          onClick={() => {
            console.log("Source button clicked");
          }}
        >
          <MdMonitor size={16} className="text-white" />
          Source
        </Button>

        <div className="w-px h-5 bg-white/30" />

        <Button
          variant="link"
          size="sm"
          onClick={toggleRecording}
          className="gap-2 text-white bg-transparent hover:bg-transparent px-3"
        >
          {recording ? (
            <>
              <FaRegStopCircle size={16} className="text-white" />
              Stop
            </>
          ) : (
            <>
              <BsRecordCircle size={16} className="text-white" />
              Record
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
