import "./App.css";
import { Button } from "@/components/ui/button"
import { useScreenRecorder } from "./hooks/useScreenRecorder";

function App() {
  const { recording, toggleRecording } = useScreenRecorder();

  return (
    <>
       <Button variant="outline" onClick={toggleRecording}>
         {recording ? "Stop Recording" : "Start Recording"}
       </Button>
        
    </>
  );
}

export default App;
