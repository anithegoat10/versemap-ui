'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../utils/supabase';

interface PendingPin {
  id: number | string;
  title: string;
  artist: string;
  category: string;
  lat: number;
  lng: number;
  google_place_id: string;
  site_status: string;
  business_status: string;
  lyric_quote: string;
  song_title: string;
  release_year: number | null;
  scene_tags: string[];
  search_query: string;
  image_url: string | null;
  audio_preview_url: string | null;
  confidence_score: number;
  created_at?: string;
}

interface ConfidenceStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
}

function getConfidenceBadgeStyle(score: number): ConfidenceStyle {
  if (8 <= score) {
    return {
      label: `High Confidence (${score}/10)`,
      bg: 'rgba(16, 185, 129, 0.16)',
      border: '#10b981',
      text: '#34d399',
    };
  }
  if (5 <= score) {
    return {
      label: `Needs Triage (${score}/10)`,
      bg: 'rgba(245, 158, 11, 0.16)',
      border: '#f59e0b',
      text: '#fbbf24',
    };
  }
  return {
    label: `Low Confidence (${score}/10)`,
    bg: 'rgba(239, 68, 68, 0.16)',
    border: '#ef4444',
    text: '#f87171',
  };
}

function getCategoryAccent(category: string): string {
  const upper = (category || '').toUpperCase();
  if (upper.includes('LYRIC')) return '#3b82f6';
  if (upper.includes('COVER') || upper.includes('ALBUM')) return '#ec4899';
  if (upper.includes('VENUE')) return '#10b981';
  if (upper.includes('TRIBUTE') || upper.includes('MURAL')) return '#a855f7';
  return '#f59e0b';
}

function normalizePendingRow(row: any, idx: number): PendingPin {
  return {
    id: row.id ?? idx,
    title: String(row.title ?? 'Untitled Candidate').trim(),
    artist: String(row.artist ?? 'Unknown Artist').trim(),
    category: String(row.category ?? 'LYRIC_MENTION').trim(),
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    google_place_id: String(row.google_place_id ?? ''),
    site_status: String(row.site_status ?? 'INTACT_PUBLIC'),
    business_status: String(row.business_status ?? 'OPERATIONAL'),
    lyric_quote: String(row.lyric_quote ?? 'No lore description provided.'),
    song_title: String(row.song_title ?? ''),
    release_year: row.release_year ? Number(row.release_year) : null,
    scene_tags: Array.isArray(row.scene_tags) ? row.scene_tags : [],
    search_query: String(row.search_query ?? ''),
    image_url: row.image_url ? String(row.image_url) : null,
    audio_preview_url: row.audio_preview_url ? String(row.audio_preview_url) : null,
    confidence_score: Number(row.confidence_score ?? 5),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export default function AdminTriagePage() {
  const [pendingPins, setPendingPins] = useState([] as PendingPin[]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState(null as string | null);
  const [statusMessage, setStatusMessage] = useState(null as string | null);
  const [processingId, setProcessingId] = useState(null as number | string | null);
  const [filterMode, setFilterMode] = useState('ALL');

  const fetchPendingQueue = async function () {
    setLoading(true);
    setErrorBanner(null);

    const { data, error } = await supabase
      .from('pending_pins')
      .select('*')
      .order('confidence_score', { ascending: false });

    if (error) {
      setErrorBanner(error.message);
      setLoading(false);
      return;
    }

    const normalizedList: PendingPin[] = (data || []).map(function (row: any, index: number) {
      return normalizePendingRow(row, index);
    });

    setPendingPins(normalizedList);
    setLoading(false);
  };

  useEffect(function () {
    fetchPendingQueue();
  }, []);

  const filteredList: PendingPin[] = useMemo(
    function () {
      return pendingPins.filter(function (item) {
        if (filterMode === 'TRIAGE_5_7') {
          return 5 <= item.confidence_score && item.confidence_score <= 7;
        }
        if (filterMode === 'HIGH_8_10') {
          return 8 <= item.confidence_score;
        }
        return true;
      });
    },
    [pendingPins, filterMode]
  );

  const handleApprovePin = async function (pin: PendingPin) {
    setProcessingId(pin.id);
    setErrorBanner(null);
    setStatusMessage(null);

    const liveInsertPayload = {
      title: pin.title,
      artist: pin.artist,
      category: pin.category,
      lat: pin.lat,
      lng: pin.lng,
      google_place_id: pin.google_place_id,
      site_status: pin.site_status,
      business_status: pin.business_status,
      lyric_quote: pin.lyric_quote,
      song_title: pin.song_title,
      release_year: pin.release_year,
      scene_tags: pin.scene_tags,
      search_query: pin.search_query,
      image_url: pin.image_url,
      audio_preview_url: pin.audio_preview_url,
    };

    const insertResult = await supabase.from('pins').insert(liveInsertPayload);

    if (insertResult.error) {
      setErrorBanner(`Approve Insert Failed: ${insertResult.error.message}`);
      setProcessingId(null);
      return;
    }

    const deleteResult = await supabase
      .from('pending_pins')
      .delete()
      .eq('id', pin.id);

    if (deleteResult.error) {
      setErrorBanner(`Approved to map, but queue cleanup failed: ${deleteResult.error.message}`);
      setProcessingId(null);
      return;
    }

    setPendingPins(function (prev) {
      return prev.filter(function (item) {
        return String(item.id) !== String(pin.id);
      });
    });

    setStatusMessage(`Approved "${pin.title}" (${pin.artist}) — now live on VerseMap!`);
    setProcessingId(null);
  };

  const handleRejectPin = async function (pin: PendingPin) {
    setProcessingId(pin.id);
    setErrorBanner(null);
    setStatusMessage(null);

    const deleteResult = await supabase
      .from('pending_pins')
      .delete()
      .eq('id', pin.id);

    if (deleteResult.error) {
      setErrorBanner(`Reject Delete Failed: ${deleteResult.error.message}`);
      setProcessingId(null);
      return;
    }

    setPendingPins(function (prev) {
      return prev.filter(function (item) {
        return String(item.id) !== String(pin.id);
      });
    });

    setStatusMessage(`Rejected and removed "${pin.title}" from the holding queue.`);
    setProcessingId(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '32px 24px 64px 24px',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* HEADER BAR */}
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingBottom: 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
                🛡️ VerseMap Admin Triage
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                {pendingPins.length} Pending Review
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#a1a1aa', marginTop: 6, marginBottom: 0 }}>
              Review harvested locations, inspect confidence scores, and publish verified pins to the live map.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={function () {
                fetchPendingQueue();
              }}
              style={{
                backgroundColor: '#18181b',
                color: '#e4e4e7',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Refresh Queue
            </button>

            <a
              href="/"
              style={{
                backgroundColor: '#f59e0b',
                color: '#09090b',
                textDecoration: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              🌍 Back to Live Map ↗
            </a>
          </div>
        </header>

        {/* FILTER CONTROLS */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <button
            onClick={function () {
              setFilterMode('ALL');
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: filterMode === 'ALL' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
              backgroundColor: filterMode === 'ALL' ? 'rgba(245, 158, 11, 0.18)' : '#121216',
              color: filterMode === 'ALL' ? '#fde68a' : '#a1a1aa',
            }}
          >
            All Candidates ({pendingPins.length})
          </button>

          <button
            onClick={function () {
              setFilterMode('TRIAGE_5_7');
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border:
                filterMode === 'TRIAGE_5_7'
                  ? '1px solid #f59e0b'
                  : '1px solid rgba(255,255,255,0.1)',
              backgroundColor:
                filterMode === 'TRIAGE_5_7' ? 'rgba(245, 158, 11, 0.18)' : '#121216',
              color: filterMode === 'TRIAGE_5_7' ? '#fde68a' : '#a1a1aa',
            }}
          >
            Needs Manual Triage: Score 5–7
          </button>

          <button
            onClick={function () {
              setFilterMode('HIGH_8_10');
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border:
                filterMode === 'HIGH_8_10'
                  ? '1px solid #10b981'
                  : '1px solid rgba(255,255,255,0.1)',
              backgroundColor:
                filterMode === 'HIGH_8_10' ? 'rgba(16, 185, 129, 0.18)' : '#121216',
              color: filterMode === 'HIGH_8_10' ? '#34d399' : '#a1a1aa',
            }}
          >
            High Confidence: Score 8–10
          </button>
        </div>

        {/* STATUS AND ERROR BANNERS */}
        {errorBanner && (
          <div
            style={{
              backgroundColor: 'rgba(127, 29, 29, 0.4)',
              border: '1px solid #ef4444',
              color: '#fecaca',
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            ⚠️ {errorBanner}
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              backgroundColor: 'rgba(6, 78, 59, 0.45)',
              border: '1px solid #10b981',
              color: '#a7f3d0',
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            ✓ {statusMessage}
          </div>
        )}

        {/* MAIN QUEUE GRID */}
        {loading ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#a1a1aa',
              backgroundColor: '#121216',
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            Loading pending_pins queue from Supabase...
          </div>
        ) : filteredList.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#a1a1aa',
              backgroundColor: '#121216',
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f4f4f5', marginBottom: 8 }}>
              🎉 Triage Queue is Clear!
            </div>
            <div style={{ fontSize: 13 }}>
              Run python3 extractor.py in your pipeline terminal to harvest new candidate pins.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: 20,
            }}
          >
            {filteredList.map(function (pin) {
              const badge = getConfidenceBadgeStyle(pin.confidence_score);
              const categoryColor = getCategoryAccent(pin.category);
              const isBusy = processingId !== null && String(processingId) === String(pin.id);
              const verifyMapUrl = `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;

              return (
                <div
                  key={pin.id}
                  style={{
                    backgroundColor: '#121216',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <div>
                    {/* TOP BADGE ROW */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 14,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '4px 8px',
                          borderRadius: 6,
                          color: categoryColor,
                          border: `1px solid ${categoryColor}`,
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        {pin.category.replace('_', ' ')}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 999,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.text,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* HEADER & THUMBNAIL */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      {pin.image_url ? (
                        <img
                          src={pin.image_url}
                          alt={pin.title}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 10,
                            objectFit: 'cover',
                            border: `2px solid ${categoryColor}`,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 10,
                            backgroundColor: '#18181c',
                            border: `2px solid ${categoryColor}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                            color: categoryColor,
                            flexShrink: 0,
                          }}
                        >
                          {pin.artist.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 17,
                            fontWeight: 800,
                            margin: 0,
                            color: '#ffffff',
                            lineHeight: 1.3,
                          }}
                        >
                          {pin.title}
                        </h3>
                        <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4, fontWeight: 600 }}>
                          {pin.artist}
                          {pin.song_title ? ` • ${pin.song_title}` : ''}
                          {pin.release_year ? ` (${pin.release_year})` : ''}
                        </div>
                      </div>
                    </div>

                    {/* LORE QUOTE */}
                    <div
                      style={{
                        backgroundColor: '#18181c',
                        borderLeft: `3px solid ${categoryColor}`,
                        padding: '10px 12px',
                        borderRadius: '0 8px 8px 0',
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: '#d4d4d8',
                        marginBottom: 14,
                      }}
                    >
                      {pin.lyric_quote}
                    </div>

                    {/* GEOCODING METADATA */}
                    <div
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 12,
                        color: '#a1a1aa',
                        marginBottom: 18,
                      }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <strong style={{ color: '#e4e4e7' }}>Query:</strong>{' '}
                        {pin.search_query || 'Direct Coordinates'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          <strong style={{ color: '#e4e4e7' }}>Coords:</strong>{' '}
                          {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                        </span>
                        <a
                          href={verifyMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#fbbf24',
                            textDecoration: 'none',
                            fontWeight: 700,
                          }}
                        >
                          Verify on Maps ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={function () {
                        handleApprovePin(pin);
                      }}
                      disabled={isBusy}
                      style={{
                        flex: 1,
                        padding: '11px 14px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: isBusy ? '#27272a' : '#10b981',
                        color: isBusy ? '#71717a' : '#052e16',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isBusy ? 'Processing...' : '✓ Approve to Live Map'}
                    </button>

                    <button
                      onClick={function () {
                        handleRejectPin(pin);
                      }}
                      disabled={isBusy}
                      style={{
                        padding: '11px 16px',
                        borderRadius: 8,
                        border: '1px solid rgba(239, 68, 68, 0.45)',
                        backgroundColor: 'rgba(239, 68, 68, 0.14)',
                        color: '#f87171',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}