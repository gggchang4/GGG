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

export type MediaPlaybackState =
  | "idle"
  | "priming"
  | "loading"
  | "playing"
  | "buffering"
  | "paused"
  | "ended"
  | "error";

type PlaybackTransportController = {
  play?: () => void;
  pause?: () => void;
  previous?: () => void;
  next?: (shuffle: boolean) => void;
  seek?: (seconds: number) => void;
  ended?: () => void;
};

type PlaybackContextValue = {
  currentAlbumIndex: number;
  currentAlbum: VinylAlbum;
  track: PlaybackTrack;
  hasPlayback: boolean;
  isPlaying: boolean;
  isPriming: boolean;
  playIntent: boolean;
  playbackState: MediaPlaybackState;
  playbackRate: number;
  currentTime: number;
  duration: number;
  volume: number;
  shuffleEnabled: boolean;
  repeatMode: PlaybackRepeatMode;
  queueIndices: number[];
  error: string | null;
  cueAlbum: (index: number) => void;
  clearPlayback: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setPlaybackRate: (value: number, commit?: boolean) => void;
  setVolume: (value: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  resetPlaybackOrder: (index: number) => void;
  recordPlaybackSelection: (index: number) => void;
  getNextAlbumIndex: (shuffle?: boolean) => number | null;
  takePreviousAlbumIndex: () => number | null;
  selectAndPlay: (index: number) => void;
  next: (shuffle?: boolean) => void;
  previous: () => void;
  registerTransportController: (
    controller: PlaybackTransportController,
  ) => () => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function wrapAlbumIndex(index: number) {
  return ((index % vinylAlbums.length) + vinylAlbums.length) % vinylAlbums.length;
}

function createShuffleQueue(currentIndex: number) {
  const queue = vinylAlbums
    .map((_, index) => index)
    .filter((index) => index !== currentIndex);

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[target]] = [queue[target], queue[index]];
  }

  return queue;
}

function getSequentialQueue(
  currentIndex: number,
  repeatMode: PlaybackRepeatMode,
) {
  const remaining = vinylAlbums.length - currentIndex - 1;
  const count =
    repeatMode === "all"
      ? Math.min(5, vinylAlbums.length - 1)
      : Math.min(5, remaining);

  return Array.from({ length: count }, (_, offset) =>
    wrapAlbumIndex(currentIndex + offset + 1),
  );
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
  const playbackRateRef = useRef(1);
  const primingRef = useRef(false);
  const playIntentRef = useRef(false);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef<PlaybackRepeatMode>("off");
  const shuffleQueueRef = useRef<number[]>([]);
  const playbackHistoryRef = useRef<number[]>([]);
  const requestIdRef = useRef(0);
  const nextRef = useRef<(shuffle?: boolean) => void>(() => undefined);
  const transportControllerRef = useRef<PlaybackTransportController | null>(
    null,
  );

  const [currentAlbumIndex, setCurrentAlbumIndex] = useState(DEFAULT_ALBUM_INDEX);
  const [hasPlayback, setHasPlayback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
  const [playIntent, setPlayIntentState] = useState(false);
  const [playbackState, setPlaybackState] =
    useState<MediaPlaybackState>("idle");
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<PlaybackRepeatMode>("off");
  const [shuffleQueue, setShuffleQueue] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentAlbum = vinylAlbums[currentAlbumIndex];
  const track = getPlaybackTrack(currentAlbum.id);

  const setPlayIntent = useCallback((nextIntent: boolean) => {
    playIntentRef.current = nextIntent;
    setPlayIntentState(nextIntent);
  }, []);

  const replaceShuffleQueue = useCallback((nextQueue: number[]) => {
    shuffleQueueRef.current = nextQueue;
    setShuffleQueue(nextQueue);
  }, []);

  const resetPlaybackOrder = useCallback(
    (index: number) => {
      const nextIndex = wrapAlbumIndex(index);
      playbackHistoryRef.current = [nextIndex];
      replaceShuffleQueue(
        shuffleRef.current ? createShuffleQueue(nextIndex) : [],
      );
    },
    [replaceShuffleQueue],
  );

  const recordPlaybackSelection = useCallback(
    (index: number) => {
      const nextIndex = wrapAlbumIndex(index);
      const history = playbackHistoryRef.current;

      if (history[history.length - 1] !== nextIndex) {
        playbackHistoryRef.current = [...history.slice(-31), nextIndex];
      }

      if (!shuffleRef.current) {
        return;
      }

      let nextQueue = shuffleQueueRef.current.filter(
        (queuedIndex) => queuedIndex !== nextIndex,
      );

      if (nextQueue.length === 0 && repeatModeRef.current === "all") {
        nextQueue = createShuffleQueue(nextIndex);
      }

      replaceShuffleQueue(nextQueue);
    },
    [replaceShuffleQueue],
  );

  const getNextAlbumIndex = useCallback(
    (shuffle = shuffleRef.current) => {
      const currentIndex = albumIndexRef.current;

      if (shuffle && vinylAlbums.length > 1) {
        let queue = shuffleQueueRef.current;

        if (queue.length === 0) {
          if (repeatModeRef.current !== "all") {
            return null;
          }

          queue = createShuffleQueue(currentIndex);
          replaceShuffleQueue(queue);
        }

        return queue[0] ?? null;
      }

      if (currentIndex < vinylAlbums.length - 1) {
        return currentIndex + 1;
      }

      return repeatModeRef.current === "all" ? 0 : null;
    },
    [replaceShuffleQueue],
  );

  const takePreviousAlbumIndex = useCallback(() => {
    const currentIndex = albumIndexRef.current;

    if (!shuffleRef.current) {
      if (currentIndex > 0) {
        return currentIndex - 1;
      }

      return repeatModeRef.current === "all"
        ? vinylAlbums.length - 1
        : null;
    }

    const history = playbackHistoryRef.current;
    if (history.length <= 1) {
      return null;
    }

    const previousIndex = history[history.length - 2];
    playbackHistoryRef.current = history.slice(0, -1);
    replaceShuffleQueue([
      currentIndex,
      ...shuffleQueueRef.current.filter(
        (index) => index !== currentIndex && index !== previousIndex,
      ),
    ]);
    return previousIndex;
  }, [replaceShuffleQueue]);

  const registerTransportController = useCallback(
    (controller: PlaybackTransportController) => {
      transportControllerRef.current = controller;

      return () => {
        if (transportControllerRef.current === controller) {
          transportControllerRef.current = null;
        }
      };
    },
    [],
  );

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
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      audio.preservesPitch = false;
      playbackRateRef.current = 1;
      setPlaybackRateState(1);
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
          if (primingRef.current) {
            setIsPlaying(false);
            setPlaybackState("priming");
            return;
          }

          const canRenderAudio =
            playIntentRef.current &&
            !audio.paused &&
            !audio.ended &&
            audio.readyState >= 3;
          setIsPlaying(canRenderAudio);
          setPlaybackState(canRenderAudio ? "playing" : "loading");
        })
        .catch((reason: unknown) => {
          if (
            requestId !== requestIdRef.current ||
            (reason instanceof DOMException && reason.name === "AbortError")
          ) {
            return;
          }

          primingRef.current = false;
          setPlayIntent(false);
          setIsPriming(false);
          setIsPlaying(false);
          setPlaybackState("error");
          setError(describePlayRejection(reason));
        });
    },
    [setPlayIntent],
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
        setPlayIntent(false);
        setIsPriming(false);
        setIsPlaying(false);
        setPlaybackState("error");
        setError(describePlayRejection(reason));
      }
    },
    [setPlayIntent, settlePlayRequest],
  );

  const cueAlbum = useCallback(
    (index: number) => {
      const requestId = ++requestIdRef.current;

      primingRef.current = true;
      setPlayIntent(false);
      setHasPlayback(true);
      setIsPriming(true);
      setIsPlaying(false);
      setPlaybackState("priming");

      const audio = ensureAlbumSource(index);

      if (!audio) {
        primingRef.current = false;
        setIsPriming(false);
        setPlaybackState("error");
        setError("The audio player is not available yet.");
        return;
      }

      audio.muted = true;
      audio.volume = volumeRef.current;
      audio.currentTime = 0;
      setCurrentTime(0);
      requestPlay(audio, requestId);
    },
    [ensureAlbumSource, requestPlay, setPlayIntent],
  );

  const play = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const wasPriming = primingRef.current;

    setHasPlayback(true);
    primingRef.current = false;
    setPlayIntent(true);
    setIsPriming(false);
    setIsPlaying(false);
    setPlaybackState("loading");

    const audio = ensureAlbumSource(albumIndexRef.current);

    if (!audio) {
      setPlayIntent(false);
      setPlaybackState("error");
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
  }, [ensureAlbumSource, requestPlay, setPlayIntent]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    const wasPriming = primingRef.current;

    ++requestIdRef.current;
    primingRef.current = false;
    setPlayIntent(false);
    setIsPriming(false);
    setIsPlaying(false);
    setPlaybackState(audio?.dataset.albumId ? "paused" : "idle");

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
  }, [setPlayIntent]);

  const clearPlayback = useCallback(() => {
    const audio = audioRef.current;

    ++requestIdRef.current;
    primingRef.current = false;
    setPlayIntent(false);
    setHasPlayback(false);
    setIsPriming(false);
    setIsPlaying(false);
    setPlaybackState("idle");
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    playbackHistoryRef.current = [];
    replaceShuffleQueue([]);
    playbackRateRef.current = 1;
    setPlaybackRateState(1);

    if (!audio) {
      return;
    }

    delete audio.dataset.albumId;
    audio.pause();
    audio.muted = false;
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    audio.removeAttribute("src");
    audio.load();
  }, [replaceShuffleQueue, setPlayIntent]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;

    if (!playIntentRef.current || primingRef.current || !audio) {
      play();
      return;
    }

    pause();
  }, [pause, play]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;

      if (!audio || !Number.isFinite(seconds)) {
        return;
      }

      const maximum = Number.isFinite(audio.duration) ? audio.duration : 0;
      const nextTime = clamp(seconds, 0, maximum);
      const reachesEnd = maximum > 0 && nextTime >= maximum - 0.05;

      if (reachesEnd) {
        ++requestIdRef.current;
        primingRef.current = false;
        setPlayIntent(false);
        setIsPriming(false);
        setIsPlaying(false);
        audio.pause();
      }

      audio.currentTime = nextTime;
      setCurrentTime(nextTime);

      if (reachesEnd) {
        setPlaybackState("ended");
      } else if (!playIntentRef.current && audio.dataset.albumId) {
        setPlaybackState("paused");
      }
    },
    [setPlayIntent],
  );

  const setPlaybackRate = useCallback((value: number, commit = true) => {
    const audio = audioRef.current;

    if (!Number.isFinite(value)) {
      return;
    }

    const nextRate = clamp(value, 0.25, 4);
    playbackRateRef.current = nextRate;

    if (audio) {
      audio.preservesPitch = false;
      if (commit || Math.abs(audio.playbackRate - nextRate) >= 0.002) {
        audio.playbackRate = nextRate;
      }
    }

    if (commit) {
      setPlaybackRateState(nextRate);
    }
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
    const nextValue = !shuffleRef.current;
    shuffleRef.current = nextValue;
    setShuffleEnabled(nextValue);
    replaceShuffleQueue(
      nextValue ? createShuffleQueue(albumIndexRef.current) : [],
    );
  }, [replaceShuffleQueue]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((current) => {
      const nextMode: PlaybackRepeatMode =
        current === "off" ? "all" : current === "all" ? "one" : "off";
      repeatModeRef.current = nextMode;

      if (
        nextMode === "all" &&
        shuffleRef.current &&
        shuffleQueueRef.current.length === 0
      ) {
        replaceShuffleQueue(createShuffleQueue(albumIndexRef.current));
      }

      return nextMode;
    });
  }, [replaceShuffleQueue]);

  const selectAndPlay = useCallback(
    (index: number) => {
      const requestId = ++requestIdRef.current;

      primingRef.current = false;
      setPlayIntent(true);
      setHasPlayback(true);
      setIsPriming(false);
      setIsPlaying(false);
      setPlaybackState("loading");

      const audio = ensureAlbumSource(index);

      if (!audio) {
        setPlayIntent(false);
        setPlaybackState("error");
        setError("The audio player is not available yet.");
        return;
      }

      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = volumeRef.current;
      setCurrentTime(0);
      requestPlay(audio, requestId);
    },
    [ensureAlbumSource, requestPlay, setPlayIntent],
  );

  const next = useCallback(
    (shuffle = shuffleRef.current) => {
      const nextIndex = getNextAlbumIndex(shuffle);

      if (nextIndex === null) {
        return;
      }

      recordPlaybackSelection(nextIndex);
      selectAndPlay(nextIndex);
    },
    [getNextAlbumIndex, recordPlaybackSelection, selectAndPlay],
  );

  const previous = useCallback(() => {
    const audio = audioRef.current;

    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }

    const previousIndex = takePreviousAlbumIndex();
    if (previousIndex === null) {
      seek(0);
      return;
    }

    if (!shuffleRef.current) {
      recordPlaybackSelection(previousIndex);
    }
    selectAndPlay(previousIndex);
  }, [recordPlaybackSelection, seek, selectAndPlay, takePreviousAlbumIndex]);

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
      setIsPlaying(false);
      setPlaybackState(primingRef.current ? "priming" : "loading");
    };
    const handlePlaying = () => {
      if (primingRef.current) {
        setIsPlaying(false);
        setPlaybackState("priming");
        return;
      }

      const playing =
        playIntentRef.current && !audio.paused && !audio.ended;
      setIsPlaying(playing);
      setPlaybackState(playing ? "playing" : "paused");
    };
    const handlePause = () => {
      setIsPlaying(false);

      if (!audio.dataset.albumId) {
        setPlaybackState("idle");
      } else if (primingRef.current) {
        setPlaybackState("priming");
      } else if (audio.ended) {
        setPlaybackState("ended");
      } else if (playIntentRef.current) {
        setPlaybackState("loading");
      } else {
        setPlaybackState("paused");
      }
    };
    const handleBuffering = () => {
      if (
        !primingRef.current &&
        playIntentRef.current &&
        (audio.readyState < 3 || audio.seeking)
      ) {
        setIsPlaying(false);
        setPlaybackState("buffering");
      }
    };
    const handleSeeked = () => {
      if (primingRef.current || !playIntentRef.current) {
        return;
      }

      const playing = !audio.paused && !audio.ended && audio.readyState >= 3;
      setIsPlaying(playing);
      setPlaybackState(playing ? "playing" : "loading");
    };
    const handleEnded = () => {
      setIsPlaying(false);

      if (primingRef.current) {
        setPlaybackState("priming");
        const requestId = ++requestIdRef.current;
        audio.currentTime = 0;
        requestPlay(audio, requestId);
        return;
      }

      setPlayIntent(false);
      setPlaybackState("ended");

      if (transportControllerRef.current?.ended) {
        transportControllerRef.current.ended();
        return;
      }

      if (repeatModeRef.current === "one") {
        const requestId = ++requestIdRef.current;
        setPlayIntent(true);
        setPlaybackState("loading");
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
      setPlayIntent(false);
      setIsPriming(false);
      setIsPlaying(false);
      setPlaybackState("error");
      setError(describeMediaError(audio.error));
    };
    const handleEmptied = () => {
      setCurrentTime(0);
      setDuration(0);
      if (!audio.dataset.albumId) {
        setPlaybackState("idle");
      } else if (!primingRef.current && playIntentRef.current) {
        setPlaybackState("loading");
      }
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("volumechange", syncVolume);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleBuffering);
    audio.addEventListener("stalled", handleBuffering);
    audio.addEventListener("seeking", handleBuffering);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("emptied", handleEmptied);

    return () => {
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("volumechange", syncVolume);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleBuffering);
      audio.removeEventListener("stalled", handleBuffering);
      audio.removeEventListener("seeking", handleBuffering);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("emptied", handleEmptied);
    };
  }, [requestPlay, setPlayIntent]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = hasPlayback
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: `${currentAlbum.title} sleeve · FreePD CC0 Collection`,
          artwork: [
            {
              src: new URL(currentAlbum.cover, window.location.origin).href,
              sizes: "512x512",
            },
          ],
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
      play: () => {
        const handler = transportControllerRef.current?.play;
        if (handler) {
          handler();
        } else {
          play();
        }
      },
      pause: () => {
        const handler = transportControllerRef.current?.pause;
        if (handler) {
          handler();
        } else {
          pause();
        }
      },
      previoustrack: () => {
        const handler = transportControllerRef.current?.previous;
        if (handler) {
          handler();
        } else {
          previous();
        }
      },
      nexttrack: () => {
        const handler = transportControllerRef.current?.next;
        if (handler) {
          handler(shuffleRef.current);
        } else {
          next(shuffleRef.current);
        }
      },
      seekbackward: (details) => {
        const target =
          (audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 10);
        const handler = transportControllerRef.current?.seek;
        if (handler) {
          handler(target);
        } else {
          seek(target);
        }
      },
      seekforward: (details) => {
        const target =
          (audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 10);
        const handler = transportControllerRef.current?.seek;
        if (handler) {
          handler(target);
        } else {
          seek(target);
        }
      },
      seekto: (details) => {
        if (typeof details.seekTime === "number") {
          const handler = transportControllerRef.current?.seek;
          if (handler) {
            handler(details.seekTime);
          } else {
            seek(details.seekTime);
          }
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
      ? isPlaying || playbackState === "buffering"
        ? "playing"
        : "paused"
      : "none";
  }, [hasPlayback, isPlaying, playbackState]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    try {
      if (!hasPlayback || duration <= 0 || !Number.isFinite(duration)) {
        navigator.mediaSession.setPositionState();
        return;
      }

      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: audioRef.current?.playbackRate ?? 1,
        position: clamp(currentTime, 0, duration),
      });
    } catch {
      // Position state is optional and stricter in some browser versions.
    }
  }, [currentTime, duration, hasPlayback, playbackRate]);

  const queueIndices = useMemo(
    () =>
      shuffleEnabled
        ? shuffleQueue.slice(0, 5)
        : getSequentialQueue(currentAlbumIndex, repeatMode),
    [currentAlbumIndex, repeatMode, shuffleEnabled, shuffleQueue],
  );

  const value = useMemo<PlaybackContextValue>(
    () => ({
      currentAlbumIndex,
      currentAlbum,
      track,
      hasPlayback,
      isPlaying,
      isPriming,
      playIntent,
      playbackState,
      playbackRate,
      currentTime,
      duration,
      volume,
      shuffleEnabled,
      repeatMode,
      queueIndices,
      error,
      cueAlbum,
      clearPlayback,
      play,
      pause,
      toggle,
      seek,
      setPlaybackRate,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      resetPlaybackOrder,
      recordPlaybackSelection,
      getNextAlbumIndex,
      takePreviousAlbumIndex,
      selectAndPlay,
      next,
      previous,
      registerTransportController,
    }),
    [
      cueAlbum,
      clearPlayback,
      currentAlbum,
      currentAlbumIndex,
      currentTime,
      duration,
      error,
      hasPlayback,
      isPlaying,
      isPriming,
      playIntent,
      playbackState,
      playbackRate,
      queueIndices,
      cycleRepeat,
      getNextAlbumIndex,
      next,
      pause,
      play,
      previous,
      recordPlaybackSelection,
      registerTransportController,
      resetPlaybackOrder,
      seek,
      setPlaybackRate,
      selectAndPlay,
      setVolume,
      shuffleEnabled,
      repeatMode,
      toggleShuffle,
      toggle,
      takePreviousAlbumIndex,
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
