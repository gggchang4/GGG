"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getPlaybackTrack, type PlaybackTrack } from "@/data/playbackCatalog";
import { vinylAlbums, type VinylAlbum } from "@/data/records";

const DEFAULT_ALBUM_INDEX = Math.max(
  vinylAlbums.findIndex((album) => album.id === "yeezus"),
  0,
);
const DEFAULT_VOLUME = 0.82;

export type PlaybackRepeatMode = "off" | "all" | "one";

type PlaybackContextValue = {
  currentAlbumIndex: number;
  currentAlbum: VinylAlbum;
  track: PlaybackTrack;
  hasPlayback: boolean;
  isPlaying: boolean;
  isPriming: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleEnabled: boolean;
  repeatMode: PlaybackRepeatMode;
  error: string | null;
  cueAlbum: (index: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  selectAndPlay: (index: number) => void;
  next: (shuffle?: boolean) => void;
  previous: () => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function wrapAlbumIndex(index: number) {
  return ((index % vinylAlbums.length) + vinylAlbums.length) % vinylAlbums.length;
}

function describeMediaError(error: MediaError | null) {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Playback was interrupted.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "The preview could not be loaded from the network.";
    case MediaError.MEDIA_ERR_DECODE:
      return "This preview could not be decoded.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This browser cannot play the preview format.";
    default:
      return "The preview could not be played.";
  }
}

function describePlayRejection(reason: unknown) {
  if (reason instanceof DOMException && reason.name === "NotAllowedError") {
    return "Playback needs another click before it can start.";
  }

  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return "The preview could not be started.";
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const albumIndexRef = useRef(DEFAULT_ALBUM_INDEX);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const primingRef = useRef(false);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef<PlaybackRepeatMode>("off");
  const requestIdRef = useRef(0);
  const nextRef = useRef<(shuffle?: boolean) => void>(() => undefined);

  const [currentAlbumIndex, setCurrentAlbumIndex] = useState(DEFAULT_ALBUM_INDEX);
  const [hasPlayback, setHasPlayback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<PlaybackRepeatMode>("off");
  const [error, setError] = useState<string | null>(null);

  const currentAlbum = vinylAlbums[currentAlbumIndex];
  const track = getPlaybackTrack(currentAlbum.id);

  const ensureAlbumSource = useCallback((index: number) => {
    const wrappedIndex = wrapAlbumIndex(index);
    const album = vinylAlbums[wrappedIndex];
    const nextTrack = getPlaybackTrack(album.id);
    const audio = audioRef.current;

    albumIndexRef.current = wrappedIndex;
    setCurrentAlbumIndex(wrappedIndex);
    setError(null);

    if (!audio) {
      return null;
    }

    const sourceChanged = audio.dataset.albumId !== album.id;

    if (sourceChanged) {
      audio.pause();
      audio.src = nextTrack.src;
      audio.dataset.albumId = album.id;
    }

    if (sourceChanged || audio.error) {
      audio.load();
      setCurrentTime(0);
      setDuration(0);
    }

    return audio;
  }, []);

  const settlePlayRequest = useCallback(
    (audio: HTMLAudioElement, requestId: number, promise: Promise<void>) => {
      void promise
        .then(() => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          setError(null);
          setIsPlaying(!primingRef.current && !audio.paused && !audio.ended);
        })
        .catch((reason: unknown) => {
          if (
            requestId !== requestIdRef.current ||
            (reason instanceof DOMException && reason.name === "AbortError")
          ) {
            return;
          }

          primingRef.current = false;
          setIsPriming(false);
          setIsPlaying(false);
          setError(describePlayRejection(reason));
        });
    },
    [],
  );

  const requestPlay = useCallback(
    (audio: HTMLAudioElement, requestId: number) => {
      try {
        settlePlayRequest(audio, requestId, audio.play());
      } catch (reason) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        primingRef.current = false;
        setIsPriming(false);
        setIsPlaying(false);
        setError(describePlayRejection(reason));
      }
    },
    [settlePlayRequest],
  );

  const cueAlbum = useCallback(
    (index: number) => {
      const requestId = ++requestIdRef.current;

      primingRef.current = true;
      setHasPlayback(true);
      setIsPriming(true);
      setIsPlaying(false);

      const audio = ensureAlbumSource(index);

      if (!audio) {
        primingRef.current = false;
        setIsPriming(false);
        setError("The audio player is not available yet.");
        return;
      }

      audio.muted = true;
      audio.volume = volumeRef.current;
      audio.currentTime = 0;
      setCurrentTime(0);
      requestPlay(audio, requestId);
    },
    [ensureAlbumSource, requestPlay],
  );

  const play = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const wasPriming = primingRef.current;

    setHasPlayback(true);
    primingRef.current = false;
    setIsPriming(false);
    setIsPlaying(false);

    const audio = ensureAlbumSource(albumIndexRef.current);

    if (!audio) {
      setError("The audio player is not available yet.");
      return;
    }

    if (wasPriming || audio.ended) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    audio.muted = false;
    audio.volume = volumeRef.current;
    requestPlay(audio, requestId);
  }, [ensureAlbumSource, requestPlay]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    const wasPriming = primingRef.current;

    ++requestIdRef.current;
    primingRef.current = false;
    setIsPriming(false);
    setIsPlaying(false);

    if (!audio) {
      return;
    }

    audio.pause();
    audio.muted = false;
    audio.volume = volumeRef.current;

    if (wasPriming) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;

    if (primingRef.current || !audio || audio.paused || audio.ended) {
      play();
      return;
    }

    pause();
  }, [pause, play]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(seconds)) {
      return;
    }

    const maximum = Number.isFinite(audio.duration) ? audio.duration : 0;
    const nextTime = clamp(seconds, 0, maximum);

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }

    const nextVolume = clamp(value, 0, 1);
    const audio = audioRef.current;

    volumeRef.current = nextVolume;
    setVolumeState(nextVolume);

    if (audio) {
      audio.volume = nextVolume;
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled((current) => {
      const nextValue = !current;
      shuffleRef.current = nextValue;
      return nextValue;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((current) => {
      const nextMode: PlaybackRepeatMode =
        current === "off" ? "all" : current === "all" ? "one" : "off";
      repeatModeRef.current = nextMode;
      return nextMode;
    });
  }, []);

  const selectAndPlay = useCallback(
    (index: number) => {
      const requestId = ++requestIdRef.current;

      primingRef.current = false;
      setHasPlayback(true);
      setIsPriming(false);
      setIsPlaying(false);

      const audio = ensureAlbumSource(index);

      if (!audio) {
        setError("The audio player is not available yet.");
        return;
      }

      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = volumeRef.current;
      setCurrentTime(0);
      requestPlay(audio, requestId);
    },
    [ensureAlbumSource, requestPlay],
  );

  const next = useCallback(
    (shuffle = false) => {
      let nextIndex = wrapAlbumIndex(albumIndexRef.current + 1);

      if (shuffle && vinylAlbums.length > 1) {
        const offset = 1 + Math.floor(Math.random() * (vinylAlbums.length - 1));
        nextIndex = wrapAlbumIndex(albumIndexRef.current + offset);
      }

      selectAndPlay(nextIndex);
    },
    [selectAndPlay],
  );

  const previous = useCallback(() => {
    selectAndPlay(albumIndexRef.current - 1);
  }, [selectAndPlay]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const syncDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const syncTime = () => setCurrentTime(audio.currentTime);
    const syncVolume = () => {
      volumeRef.current = audio.volume;
      setVolumeState(audio.volume);
    };
    const handlePlay = () => {
      setIsPlaying(!primingRef.current && !audio.paused && !audio.ended);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);

      if (primingRef.current) {
        const requestId = ++requestIdRef.current;
        audio.currentTime = 0;
        requestPlay(audio, requestId);
        return;
      }

      if (repeatModeRef.current === "one") {
        const requestId = ++requestIdRef.current;
        audio.currentTime = 0;
        setCurrentTime(0);
        requestPlay(audio, requestId);
        return;
      }

      const isLastAlbum = albumIndexRef.current === vinylAlbums.length - 1;
      if (
        repeatModeRef.current === "off" &&
        !shuffleRef.current &&
        isLastAlbum
      ) {
        return;
      }

      nextRef.current(shuffleRef.current);
    };
    const handleError = () => {
      primingRef.current = false;
      setIsPriming(false);
      setIsPlaying(false);
      setError(describeMediaError(audio.error));
    };
    const handleEmptied = () => {
      setCurrentTime(0);
      setDuration(0);
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("volumechange", syncVolume);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("playing", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("emptied", handleEmptied);

    return () => {
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("volumechange", syncVolume);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("playing", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("emptied", handleEmptied);
    };
  }, [requestPlay]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = hasPlayback
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: "FreePD CC0 Collection",
        })
      : null;
  }, [currentAlbum, hasPlayback, track]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler | null>
    > = {
      play,
      pause,
      previoustrack: previous,
      nexttrack: () => next(shuffleRef.current),
      seekbackward: (details) =>
        seek((audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 10)),
      seekforward: (details) =>
        seek((audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 10)),
      seekto: (details) => {
        if (typeof details.seekTime === "number") {
          seek(details.seekTime);
        }
      },
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          handler ?? null,
        );
      } catch {
        // Browsers expose different subsets of the Media Session actions.
      }
    }

    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch {
          // Ignore unsupported actions during cleanup as well.
        }
      }
    };
  }, [next, pause, play, previous, seek]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = hasPlayback
      ? isPlaying
        ? "playing"
        : "paused"
      : "none";
  }, [hasPlayback, isPlaying]);

  useEffect(() => {
    if (
      !("mediaSession" in navigator) ||
      !hasPlayback ||
      duration <= 0 ||
      !Number.isFinite(duration)
    ) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audioRef.current?.playbackRate ?? 1,
        position: clamp(currentTime, 0, duration),
      });
    } catch {
      // Position state is optional and stricter in some browser versions.
    }
  }, [currentTime, duration, hasPlayback]);

  const value = useMemo<PlaybackContextValue>(
    () => ({
      currentAlbumIndex,
      currentAlbum,
      track,
      hasPlayback,
      isPlaying,
      isPriming,
      currentTime,
      duration,
      volume,
      shuffleEnabled,
      repeatMode,
      error,
      cueAlbum,
      play,
      pause,
      toggle,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      selectAndPlay,
      next,
      previous,
    }),
    [
      cueAlbum,
      currentAlbum,
      currentAlbumIndex,
      currentTime,
      duration,
      error,
      hasPlayback,
      isPlaying,
      isPriming,
      cycleRepeat,
      next,
      pause,
      play,
      previous,
      seek,
      selectAndPlay,
      setVolume,
      shuffleEnabled,
      repeatMode,
      toggleShuffle,
      toggle,
      track,
      volume,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      <audio ref={audioRef} hidden preload="metadata" playsInline />
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);

  if (!context) {
    throw new Error("usePlayback must be used within PlaybackProvider.");
  }

  return context;
}
