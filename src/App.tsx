import { useScreenRecorder } from "./hooks/useScreenRecorder";
import { Button } from "@/components/ui/button";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdClose } from "react-icons/md";

export default function App() {
  const { recording, toggleRecording } = useScreenRecorder();

  return (
    <div className="w-full h-full flex flex-row items-center backdrop-blur-md px-4 gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 rounded-full text-white hover:bg-transparent"
        title="Close"
        onClick={() => window.close()}
      >
        <MdClose size={18} className="text-white"/>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleRecording}
        title={recording ? "Stop Recording" : "Start Recording"}
        className="rounded-full flex items-center justify-center hover:bg-transparent"
      >
        {recording ? (
          <FaRegStopCircle size={16} className="text-red-500" />
        ) : (
          <BsRecordCircle size={16} className="text-white" />
        )}
      </Button>
    </div>
  );
}
