import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Captions,
  RotateCcw,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';

interface StudentVideoProps {
  videoUrl: string;
  title: string;
  duration: string;
  type: string;
  completed: boolean;
  onClose: () => void;
  topicDetails: any;
}

const StudentVideo: React.FC<StudentVideoProps> = ({
  videoUrl,
  title,
  duration,
  type,
  completed,
  onClose,
  topicDetails,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationTime, setDurationTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [completedState, setCompletedState] = useState(completed);
  const [isVideoClosed, setIsVideoClosed] = useState(false);

  // Format time in MM:SS format
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Skip forward/backward
  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  // Change playback rate
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Handle video end
  const handleEnded = () => {
    setIsPlaying(false);
    setCompletedState(true);
    // You might want to update the completion status in your backend here
  };

  // Reset controls timeout
  const resetControlsTimeout = () => {
    if (controlsTimeout) clearTimeout(controlsTimeout);
    setShowControls(true);
    setControlsTimeout(
      setTimeout(() => {
        setShowControls(false);
      }, 3000)
    );
  };

  // Handle close video
  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setIsVideoClosed(true);
    onClose();
  };

  // Effect to set up event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDurationTime(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('click', togglePlay);

    // Set initial volume
    video.volume = volume;

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('click', togglePlay);
      if (controlsTimeout) clearTimeout(controlsTimeout);
    };
  }, []);

  // Effect to handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset video when URL changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [videoUrl]);

  // Don't render if video is closed
  if (isVideoClosed) {
    return null;
  }

  return (
    <div className="w-full h-full flex">
      {/* Video container */}
      <div 
        ref={containerRef}
        className="relative bg-black flex-1 flex justify-center items-center group"
        onMouseMove={resetControlsTimeout}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full max-h-screen object-contain"
          src={videoUrl}
          onClick={togglePlay}
        />

        {/* Top info bar */}
        <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-white font-semibold text-lg">{title}</h2>
              <p className="text-gray-300 text-sm">
                {topicDetails?.title} • {type} • {duration}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {completedState && (
                <div className="flex items-center gap-1 text-green-400 bg-green-900/30 px-2 py-1 rounded">
                  <CheckCircle size={16} />
                  <span className="text-sm">Completed</span>
                </div>
              )}
              <button
                onClick={handleClose}
                className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Center play button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <div className="bg-black/50 rounded-full p-4">
              <Play size={48} className="text-white" />
            </div>
          </button>
        )}

        {/* Controls bar */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={durationTime || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(durationTime)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <button
                onClick={() => skip(-10)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <RotateCcw size={20} />
              </button>

              <button
                onClick={() => skip(10)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SkipForward size={20} />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              <div className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(durationTime)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <Settings size={20} />
                </button>

                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-md p-2 w-32">
                    <div className="text-white text-xs font-medium mb-1">Playback Speed</div>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`block w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-700 ${
                          playbackRate === rate ? 'text-blue-400 font-medium' : 'text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Playback rate indicator */}
        {playbackRate !== 1 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-3 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {playbackRate}x
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentVideo;