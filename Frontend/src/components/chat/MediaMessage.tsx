import React, { useState } from 'react';
import { Download, Play, Pause, Volume2, FileText, Music, StickyNote, X } from 'lucide-react';

interface MediaMessageProps {
  waMessageId: string;
  mediaType: 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';
  mediaFilename?: string;
  mediaFilesize?: number;
  mediaDuration?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaPageCount?: number;
  mediaCaption?: string;
  mediaThumbnailUrl?: string;
  text?: string;
}

const MediaMessage: React.FC<MediaMessageProps> = ({
  waMessageId,
  mediaType,
  mediaFilename,
  mediaFilesize,
  mediaDuration,
  mediaWidth,
  mediaHeight,
  mediaPageCount,
  mediaCaption,
  mediaThumbnailUrl,
  text
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      // Use backend media download endpoint
      const downloadUrl = `/api/media/${waMessageId}`;
      
      // Create download link
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = mediaFilename || 'media';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const getMediaUrl = () => `/api/media/${waMessageId}`;
  const getThumbnailUrl = () => mediaThumbnailUrl ? `data:image/jpeg;base64,${mediaThumbnailUrl}` : `/api/media/${waMessageId}/thumbnail`;

  const renderMediaContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <>
            <div className="relative group max-w-[600px]">
              {/* Full image - no thumbnail, just show the actual image */}
              <img
                src={getMediaUrl()}
                alt={mediaCaption || 'Image'}
                className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity w-full max-h-[500px] object-contain"
                onClick={() => setIsFullscreen(true)}
                loading="lazy"
              />
              
              {/* Download button - top right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(getMediaUrl(), '_blank');
                }}
                className="absolute top-2 right-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Caption */}
            {mediaCaption && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                {mediaCaption}
              </div>
            )}

            {/* Fullscreen Modal */}
            {isFullscreen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
                onClick={() => setIsFullscreen(false)}
              >
                <div className="relative max-w-[90vw] max-h-[90vh]">
                  <img
                    src={getMediaUrl()}
                    alt={mediaCaption || 'Image'}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* Close button */}
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {/* Download button in fullscreen */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(getMediaUrl(), '_blank');
                    }}
                    className="absolute top-4 right-16 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        );

      case 'video':
        return (
          <div className="relative group max-w-[600px]">
            <video
              src={getMediaUrl()}
              poster={getThumbnailUrl()}
              className="rounded-lg cursor-pointer w-full max-h-[500px] object-contain"
              controls={false}
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
              <button
                onClick={togglePlayPause}
                className="bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-gray-800" />
                ) : (
                  <Play className="w-6 h-6 text-gray-800" />
                )}
              </button>
            </div>
            {mediaDuration && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                {formatDuration(mediaDuration)}
              </div>
            )}
            
            {/* Download button - top right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(getMediaUrl(), '_blank');
              }}
              className="absolute top-2 right-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        );

      case 'audio':
      case 'voice':
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[300px]">
            <button
              onClick={togglePlayPause}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={mediaFilename || (mediaType === 'voice' ? 'Voice Message' : 'Audio')}>
                {mediaFilename || (mediaType === 'voice' ? 'Voice Message' : 'Audio')}
              </div>
              {mediaDuration && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDuration(mediaDuration)}
                </div>
              )}
            </div>
            
            {/* Download button */}
            <button
              onClick={() => window.open(getMediaUrl(), '_blank')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[300px]">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={mediaFilename || 'Document'}>
                {mediaFilename || 'Document'}
              </div>
              {mediaFilesize && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(mediaFilesize)}
                </div>
              )}
            </div>
            
            {/* Download button */}
            <button
              onClick={() => window.open(getMediaUrl(), '_blank')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        );

      case 'sticker':
        return (
          <div className="max-w-[200px]">
            <img
              src={getMediaUrl()}
              alt="Sticker"
              className="w-full h-auto rounded-lg"
              style={{
                maxWidth: mediaWidth ? `${Math.min(mediaWidth, 200)}px` : '200px',
                maxHeight: mediaHeight ? `${Math.min(mediaHeight, 200)}px` : '200px'
              }}
            />
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-xs">
            <FileText className="w-6 h-6 text-gray-500" />
            <div className="flex-1">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Unsupported media type
              </div>
            </div>
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        );
    }
  };

  return (
    <>
      {/* Media content */}
      <div className="mb-2">
        {renderMediaContent()}
      </div>

      {/* Media caption */}
      {mediaCaption && (
        <div className="text-sm mt-2">
          {mediaCaption}
        </div>
      )}

      {/* Additional text (if any) */}
      {text && text !== '📎 Media' && (
        <div className="text-sm mt-2">
          {text}
        </div>
      )}
    </>
  );
};

export default MediaMessage;
