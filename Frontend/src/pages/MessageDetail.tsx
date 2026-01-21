import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Tag } from 'lucide-react';
import { getMessage } from '../services/api';
import { openWhatsApp, formatPhoneNumber } from '../services/whatsapp';
import { Button } from '../components/common/Button';
import { ClassificationBadge } from '../components/inbox/ClassificationBadge';
import { Loader } from '../components/common/Loader';
import type { Message } from '../types/message';

export const MessageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    const fetchMessage = async () => {
      if (!id) return;

      try {
        const data = await getMessage(id);
        setMessage(data);
        setNote(data?.note || '');
      } catch (error) {
        console.error('Failed to fetch message', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [id]);

  if (loading) {
    return <Loader text="Loading message..." />;
  }

  if (!message) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Message not found</h2>
          <Button onClick={() => navigate('/inbox')}>Back to Inbox</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back</span>
      </button>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Message Details</h2>
              <ClassificationBadge classification={message.classification} />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sender</label>
                <p className="text-base font-semibold text-gray-900 dark:text-white mt-1">{message.sender}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{formatPhoneNumber(message.senderNumber)}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</label>
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {new Date(message.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Confidence</label>
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {Math.round(message.confidence * 100)}%
                </p>
              </div>

              {message.detectedBrands.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Detected Brands
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.detectedBrands.map((brand) => (
                      <span
                        key={brand}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800"
                      >
                        <Tag className="w-3 h-3" />
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {message.parsedData && (
            <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Parsed Data</h2>
              <div className="grid grid-cols-2 gap-4">
                {message.parsedData.brand && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Brand</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.brand}</p>
                  </div>
                )}
                {message.parsedData.model && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Model</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.model}</p>
                  </div>
                )}
                {message.parsedData.ram && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">RAM</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.ram}</p>
                  </div>
                )}
                {message.parsedData.storage && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Storage</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.storage}</p>
                  </div>
                )}
                {message.parsedData.quantity && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.quantity} units</p>
                  </div>
                )}
                {message.parsedData.price && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">
                      ₹{message.parsedData.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
                {message.parsedData.gst && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GST</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.gst}</p>
                  </div>
                )}
                {message.parsedData.dispatch && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dispatch</label>
                    <p className="text-base text-gray-900 dark:text-white mt-1">{message.parsedData.dispatch}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Internal Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your notes here..."
              className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent resize-none placeholder-gray-500 dark:placeholder-gray-400"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Notes are stored locally</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
            <div className="space-y-3">
              <Button
                className="w-full flex items-center justify-center gap-2"
                onClick={() => openWhatsApp(message.whatsappDeepLink)}
              >
                <ExternalLink className="w-4 h-4" />
                Open in WhatsApp
              </Button>
              <Button variant="secondary" className="w-full">
                Reclassify Message
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Raw Message</h2>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <pre className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap font-mono">
                {message.rawMessage}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
