import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

export function SourceSelector() {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setLoading(true);
      const rawSources = await window.electronAPI.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });

      const formattedSources = rawSources.map(source => {
        let displayName = source.name;
        
        if (source.id.startsWith('window:') && source.name.includes(' — ')) {
          displayName = source.name.split(' — ')[1] || source.name;
        }

        return {
          id: source.id,
          name: displayName,
          thumbnail: source.thumbnail,
          display_id: source.display_id,
          appIcon: source.appIcon 
        };
      });

      setSources(formattedSources);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const screenSources = sources.filter(source => source.id.startsWith('screen:'));
  const windowSources = sources.filter(source => source.id.startsWith('window:'));

  const handleSourceSelect = (source: DesktopSource) => {
    setSelectedSource(source);
  };

  const handleShare = async () => {
    if (selectedSource) {
      await window.electronAPI.selectSource(selectedSource);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 bg-white">
        <Tabs defaultValue="screens" className="flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-100">
            <TabsTrigger value="screens" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-700">
              Screens
            </TabsTrigger>
            <TabsTrigger value="windows" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-700">
              Windows
            </TabsTrigger>
          </TabsList>
          
          <div className="h-64 overflow-hidden bg-white">
            <TabsContent value="screens" className="h-full mt-0">
              <div className="grid grid-cols-2 gap-3 h-full overflow-y-auto pr-2">
                {screenSources.map((source) => (
                  <Card
                    key={source.id}
                    className={`cursor-pointer transition-all hover:shadow-lg h-fit scale-90 p-2 ${
                      selectedSource?.id === source.id 
                        ? 'ring-2 ring-gray-700 bg-gray-50' 
                        : 'hover:ring-1 hover:ring-gray-300 bg-white border border-gray-200'
                    }`}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-3">
                      <div className="relative mb-2">
                        <img 
                          src={source.thumbnail || ''} 
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-gray-300"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center shadow-md">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {source.name}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="windows" className="h-full mt-0">
              <div className="grid grid-cols-2 gap-3 h-full overflow-y-auto pr-2">
                {windowSources.map((source) => (
                  <Card
                    key={source.id}
                    className={`cursor-pointer transition-all hover:shadow-lg h-fit ${
                      selectedSource?.id === source.id 
                        ? 'ring-2 ring-gray-700 bg-gray-50' 
                        : 'hover:ring-1 hover:ring-gray-300 bg-white border border-gray-200'
                    }`}
                    style={{ transform: 'scale(0.9)', margin: '8px' }}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-3">
                      <div className="relative mb-2">
                        <img 
                          src={source.thumbnail || ''} 
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-gray-300"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center shadow-md">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {source.appIcon && (
                          <img 
                            src={source.appIcon} 
                            alt="App icon"
                            className="w-3 h-3 flex-shrink-0"
                          />
                        )}
                        <div className="text-xs font-medium text-gray-800 truncate">
                          {source.name}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="bg-white border-t border-gray-200 p-3">
        <div className="flex justify-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => window.close()}
            className="px-6 py-1.5 text-sm bg-gray-600 border-gray-600 text-white hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleShare}
            disabled={!selectedSource}
            className="px-6 py-1.5 text-sm bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:bg-gray-400"
          >
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}