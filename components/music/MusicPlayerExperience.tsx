"use client";

import Image from "next/image";
import {
  Check,
  ChevronDown,
  Heart,
  ListMusic,
  LoaderCircle,
  MonitorSpeaker,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import gsap from "gsap";
import { getPlaybackTrack } from "@/data/playbackCatalog";
import { vinylAlbums, type VinylAlbum } from "@/data/records";
import {
  usePlayback,
  type MediaPlaybackState,
} from "@/components/music/PlaybackProvider";
import { VinylRecord } from "@/components/music/VinylRecord";
import styles from "@/components/music/music-player.module.css";

type PlayerPhase =
  | "browsing"
  | "extracting"
  | "showcase"
  | "loading"
  | "playing"
  | "switching"
  | "closing"
  | "returning";

function isTransportPhase(phase: PlayerPhase) {
  return phase === "loading" || phase === "playing" || phase === "switching";
}

type ShelfAxis = "x" | "y";

type GestureState = {
  pointerId: number | null;
  axis: ShelfAxis;
  pitch: number;
  startCoordinate: number;
  lastCoordinate: number;
  lastTime: number;
  velocity: number;
  startPosition: number;
  tapIndex: number | null;
  moved: boolean;
};

type PlaybackSpeed = 33 | 45;

type MotorState =
  | "stopped"
  | "starting"
  | "changing"
  | "locked"
  | "braking";

type TonearmState =
  | "parked"
  | "lifting"
  | "raised"
  | "traversing"
  | "lowering"
  | "tracking"
  | "returning";

type TonearmGeometry = {
  homeAngle: number;
  leadInAngle: number;
  runoutAngle: number;
  minimumAngle: number;
  maximumAngle: number;
  measured: boolean;
};

type TonearmGestureState = {
  pointerId: number | null;
  moved: boolean;
  startX: number;
  startY: number;
  grabOffset: number;
  resumeOnDrop: boolean;
};

const INITIAL_ALBUM_INDEX = 5;
const TONEARM_HOME_ANGLE = -77;
const TONEARM_PLAY_ANGLE = -66;
const TONEARM_END_ANGLE = -43;
const TONEARM_MIN_ANGLE = -79;
const TONEARM_MAX_ANGLE = -40;
const MOTOR_START_DURATION = 0.7;
const MOTOR_SPEED_CHANGE_DURATION = 0.52;
const MOTOR_STOP_DURATION = 0.78;
const TONEARM_LIFT_DURATION = 0.22;
const TONEARM_LOWER_DURATION = 0.4;
const MOTOR_SUSPEND_THRESHOLD = 0.25;
const SHELF_CYCLES = [-1, 0, 1] as const;

const FALLBACK_TONEARM_GEOMETRY: TonearmGeometry = {
  homeAngle: TONEARM_HOME_ANGLE,
  leadInAngle: TONEARM_PLAY_ANGLE,
  runoutAngle: TONEARM_END_ANGLE,
  minimumAngle: TONEARM_MIN_ANGLE,
  maximumAngle: TONEARM_MAX_ANGLE,
  measured: false,
};

const shelfInstances = SHELF_CYCLES.flatMap((cycle) =>
  vinylAlbums.map((album, albumIndex) => ({
    album,
    albumIndex,
    cycle,
    key: `${cycle}:${album.id}`,
  })),
);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getContrastingInk(color: string) {
  const hex = color.replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 154 ? "#121414" : "#f8f7f3";
}

function wrapAlbumIndex(index: number) {
  const count = vinylAlbums.length;
  return ((index % count) + count) % count;
}

function getWrappedRelative(index: number, position: number) {
  const count = vinylAlbums.length;
  const half = count / 2;
  return ((index - position + half) % count + count) % count - half;
}

function getNearestVirtualPosition(index: number, currentPosition: number) {
  const wrappedIndex = wrapAlbumIndex(index);
  const cycle = Math.round(
    (currentPosition - wrappedIndex) / vinylAlbums.length,
  );
  return wrappedIndex + cycle * vinylAlbums.length;
}

function getShelfAxis(): ShelfAxis {
  const isWideShelf =
    window.innerWidth >= 720 &&
    window.innerWidth / window.innerHeight >= 1.05;

  return isWideShelf ? "x" : "y";
}

function getEstimatedShelfSize(axis: ShelfAxis) {
  if (axis === "x") {
    return Math.min(window.innerHeight * 0.8, window.innerWidth * 0.64, 860);
  }

  return Math.min(window.innerWidth * 0.68, 320);
}

function getShelfPitch(axis = getShelfAxis(), sleeveSize?: number) {
  const estimatedSize = sleeveSize ?? getEstimatedShelfSize(axis);

  if (axis === "x") {
    return clamp(
      window.innerWidth * 0.092,
      estimatedSize * 0.145,
      estimatedSize * 0.22,
    );
  }

  return clamp(estimatedSize * 0.27, 72, 94);
}

function getShelfRelative(
  index: number,
  position: number,
  axis: ShelfAxis,
) {
  // The wide rack has one true centre slot: its sleeve becomes the vanishing
  // spine. The portrait stack keeps its half-step seam to match the reference.
  const centreOffset = axis === "x" ? 0 : 0.5;
  return getWrappedRelative(index, position + centreOffset);
}

function getShelfRotation(
  relative: number,
  axis: ShelfAxis,
  reducedMotion: boolean,
) {
  // Mirror each plane around the centre. On the wide rack the focused sleeve
  // reaches a precise edge-on 90 degrees, while its neighbours ease back to
  // the readable 80-degree fan without ever turning face-on at the centre.
  const side = relative < 0 ? -1 : 1;

  if (axis === "x") {
    const restingAngle = reducedMotion ? 78 : 80;
    const centreLock = 1 - clamp(Math.abs(relative) / 0.5, 0, 1);
    const angle = restingAngle + (90 - restingAngle) * centreLock;

    return {
      rotationX: 0,
      rotationY: -side * angle,
    };
  }

  return {
    rotationX: side * 88,
    rotationY: 0,
  };
}

function getShelfEntryPose(
  index: number,
  position: number,
  reducedMotion: boolean,
) {
  const axis = getShelfAxis();
  const relative = getShelfRelative(index, position, axis);

  return {
    axis,
    ...getShelfRotation(relative, axis, reducedMotion),
  };
}

function getShowcasePose(size: number) {
  const compact = window.innerWidth < 720;

  return {
    x: compact
      ? -Math.min(window.innerWidth * 0.12, size * 0.14)
      : -Math.min(window.innerWidth * 0.22, size * 0.62),
    y: compact ? -window.innerHeight * 0.025 : 0,
    recordX: compact ? size * 0.43 : size * 0.46,
  };
}

function getPlaybackRpm(speed: PlaybackSpeed) {
  return speed === 33 ? 33 + 1 / 3 : 45;
}

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function getTonearmAngleFromProgress(
  progress: number,
  geometry = FALLBACK_TONEARM_GEOMETRY,
) {
  return (
    geometry.leadInAngle +
    clamp(progress, 0, 1) *
      (geometry.runoutAngle - geometry.leadInAngle)
  );
}

function getProgressFromTonearmAngle(
  angle: number,
  geometry = FALLBACK_TONEARM_GEOMETRY,
) {
  const sweep = geometry.runoutAngle - geometry.leadInAngle;

  if (Math.abs(sweep) < 0.001) {
    return 0;
  }

  return clamp(
    (angle - geometry.leadInAngle) / sweep,
    0,
    1,
  );
}

function normalizeTonearmAngle(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function getTonearmYawForRadius({
  pivotX,
  pivotY,
  recordX,
  recordY,
  armLength,
  grooveRadius,
  neutralTipAngle,
  preferredAngle,
}: {
  pivotX: number;
  pivotY: number;
  recordX: number;
  recordY: number;
  armLength: number;
  grooveRadius: number;
  neutralTipAngle: number;
  preferredAngle: number;
}) {
  const offsetX = recordX - pivotX;
  const offsetY = recordY - pivotY;
  const centreDistance = Math.hypot(offsetX, offsetY);

  if (
    centreDistance <= 0 ||
    centreDistance > armLength + grooveRadius ||
    centreDistance < Math.abs(armLength - grooveRadius)
  ) {
    return null;
  }

  const along =
    (armLength ** 2 - grooveRadius ** 2 + centreDistance ** 2) /
    (2 * centreDistance);
  const heightSquared = armLength ** 2 - along ** 2;

  if (heightSquared < 0) {
    return null;
  }

  const height = Math.sqrt(heightSquared);
  const unitX = offsetX / centreDistance;
  const unitY = offsetY / centreDistance;
  const baseX = pivotX + along * unitX;
  const baseY = pivotY + along * unitY;
  const candidates = [
    { x: baseX - height * unitY, y: baseY + height * unitX },
    { x: baseX + height * unitY, y: baseY - height * unitX },
  ];

  return candidates
    .map(({ x, y }) =>
      normalizeTonearmAngle(
        (Math.atan2(y - pivotY, x - pivotX) * 180) / Math.PI -
          neutralTipAngle,
      ),
    )
    .sort(
      (angleA, angleB) =>
        Math.abs(normalizeTonearmAngle(angleA - preferredAngle)) -
        Math.abs(normalizeTonearmAngle(angleB - preferredAngle)),
    )[0];
}

function getCubicBezierValue(
  start: number,
  controlA: number,
  controlB: number,
  end: number,
  progress: number,
) {
  const inverse = 1 - progress;
  return (
    inverse ** 3 * start +
    3 * inverse ** 2 * progress * controlA +
    3 * inverse * progress ** 2 * controlB +
    progress ** 3 * end
  );
}

function setVinylPresentationVariant(
  container: HTMLElement,
  variant: "floating" | "platter",
) {
  const record = container.querySelector<HTMLElement>("[data-vinyl-root]");
  if (record) {
    record.dataset.variant = variant;
  }
}

function setStylePropertyIfChanged(
  element: HTMLElement,
  property: string,
  value: string,
) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

const ShelfItems = memo(function ShelfItems({
  activeIndex,
  phase,
  focusAlbum,
  shelfItemRefs,
  slotRefs,
}: {
  activeIndex: number;
  phase: PlayerPhase;
  focusAlbum: (index: number, extract?: boolean) => void;
  shelfItemRefs: RefObject<Array<HTMLButtonElement | null>>;
  slotRefs: RefObject<Array<HTMLButtonElement | null>>;
}) {
  return shelfInstances.map(
    ({ album, albumIndex: index, cycle, key }, instanceIndex) => {
      const albumStyle = {
        "--spine-color": album.spine,
        "--edge-color": album.edge,
        "--spine-ink": getContrastingInk(album.spine),
      } as CSSProperties;
      const canonical = cycle === 0;
      const initiallyVisible =
        Math.abs(
          getShelfRelative(index, INITIAL_ALBUM_INDEX, "x") +
            cycle * vinylAlbums.length,
        ) <= 7.5;
      const wrapsInitialSeam = index === vinylAlbums.length - 1;

      return (
        <button
          key={key}
          ref={(node) => {
            shelfItemRefs.current[instanceIndex] = node;
            if (canonical) {
              slotRefs.current[index] = node;
            }
          }}
          type="button"
          className={styles.shelfSlot}
          style={albumStyle}
          disabled={!canonical || phase !== "browsing"}
          tabIndex={canonical ? 0 : -1}
          data-shelf-slot
          data-record-index={index}
          data-shelf-cycle={cycle}
          data-shelf-clone={canonical ? undefined : true}
          data-active={canonical && index === activeIndex}
          aria-label={
            canonical ? `Select ${album.title}, ${album.year}` : undefined
          }
          aria-hidden={canonical ? undefined : true}
          aria-current={
            canonical && index === activeIndex ? "true" : undefined
          }
          onClick={(event) => {
            if (event.detail === 0) {
              focusAlbum(index, true);
            }
          }}
        >
          <span
            className={`${styles.shelfSleeve} ${styles.sleeveShell}`}
            data-shelf-sleeve
          >
            <span className={`${styles.sleeveFace} ${styles.sleeveFront}`}>
              <Image
                src={album.cover}
                alt=""
                fill
                sizes="(max-width: 719px) 68vw, min(68vh, 64vw)"
                loading={initiallyVisible || wrapsInitialSeam ? "eager" : "lazy"}
                draggable={false}
              />
            </span>
            <span
              className={`${styles.sleeveFace} ${styles.sleeveRear}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveLeft}`}
              aria-hidden="true"
            >
              <span className={styles.shelfSpineLabel}>
                <strong>{album.title}</strong>
                <small>{album.artist}</small>
              </span>
            </span>
            <span
              className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveRight}`}
              aria-hidden="true"
            >
              <span className={styles.shelfSpineLabel}>
                <strong>{album.title}</strong>
                <small>{album.artist}</small>
              </span>
            </span>
            <span
              className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveTop}`}
              aria-hidden="true"
            >
              <span className={styles.shelfSpineLabel}>
                <strong>{album.title}</strong>
                <small>{album.artist}</small>
              </span>
            </span>
            <span
              className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveBottom}`}
              aria-hidden="true"
            >
              <span className={styles.shelfSpineLabel}>
                <strong>{album.title}</strong>
                <small>{album.artist}</small>
              </span>
            </span>
          </span>
          <span className={styles.albumMeta} aria-hidden="true">
            <span className={styles.albumTitle}>{album.title}</span>
            <span className={styles.albumArtist}>{album.artist}</span>
          </span>
        </button>
      );
    },
  );
});

function Turntable({
  phase,
  album,
  onEject,
  onPrevious,
  onNext,
  onSelectAlbum,
  motorOn,
  motorState,
  speed,
  tonearmAngle,
  tonearmGeometry,
  tonearmState,
  tonearmRaised,
  stylusContact,
  tonearmDragging,
  elapsedSeconds,
  duration,
  volume,
  isPlaying,
  isPriming,
  isStarting,
  playIntent,
  playbackState,
  shuffleEnabled,
  repeatMode,
  queueIndices,
  error,
  track,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onCycleRepeat,
  onTogglePlayback,
  onToggleMotor,
  onToggleSpeed,
  onSetSpeed,
  onToggleCue,
  onTonearmPointerDown,
  onTonearmPointerMove,
  onTonearmPointerUp,
  onTonearmKeyDown,
  platterRef,
  platterStrobeRef,
  deckRecordRef,
  deckRotorRef,
  tonearmBaseRef,
  tonearmRef,
  stylusRef,
}: {
  phase: PlayerPhase;
  album: VinylAlbum | null;
  onEject: () => void;
  onPrevious: () => void;
  onNext: (shuffle?: boolean) => void;
  onSelectAlbum: (index: number, resumeOverride?: boolean) => void;
  motorOn: boolean;
  motorState: MotorState;
  speed: PlaybackSpeed;
  tonearmAngle: number;
  tonearmGeometry: TonearmGeometry;
  tonearmState: TonearmState;
  tonearmRaised: boolean;
  stylusContact: boolean;
  tonearmDragging: boolean;
  elapsedSeconds: number;
  duration: number;
  volume: number;
  isPlaying: boolean;
  isPriming: boolean;
  isStarting: boolean;
  playIntent: boolean;
  playbackState: MediaPlaybackState;
  shuffleEnabled: boolean;
  repeatMode: "off" | "all" | "one";
  queueIndices: number[];
  error: string | null;
  track: { title: string; artist: string };
  onSeek: (seconds: number) => void;
  onVolumeChange: (value: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onTogglePlayback: () => void;
  onToggleMotor: () => void;
  onToggleSpeed: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onToggleCue: () => void;
  onTonearmPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  platterRef: RefObject<HTMLDivElement | null>;
  platterStrobeRef: RefObject<HTMLSpanElement | null>;
  deckRecordRef: RefObject<HTMLButtonElement | null>;
  deckRotorRef: RefObject<HTMLSpanElement | null>;
  tonearmBaseRef: RefObject<HTMLDivElement | null>;
  tonearmRef: RefObject<HTMLButtonElement | null>;
  stylusRef: RefObject<HTMLSpanElement | null>;
}) {
  const spinDuration = 60 / getPlaybackRpm(speed);
  const transportPhase = isTransportPhase(phase);
  const transportLocked = !album || !transportPhase;
  const mechanicsLocked = !album || phase !== "playing";
  const seekLocked = transportLocked || duration <= 0;
  const tonearmSweepMinimum = Math.min(
    tonearmGeometry.leadInAngle,
    tonearmGeometry.runoutAngle,
  );
  const tonearmSweepMaximum = Math.max(
    tonearmGeometry.leadInAngle,
    tonearmGeometry.runoutAngle,
  );
  const tonearmOnRecord =
    tonearmAngle >= tonearmSweepMinimum - 0.75 &&
    tonearmAngle <= tonearmSweepMaximum + 0.75;
  const queueEntries = album
    ? queueIndices.map((index) => ({ album: vinylAlbums[index], index }))
    : [];
  const [likedAlbums, setLikedAlbums] = useState<Set<string>>(() => new Set());
  const [queueOpen, setQueueOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [stylusLightOn, setStylusLightOn] = useState(true);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const transportActive = !error && (playIntent || isStarting);
  const queueVisible = queueOpen && transportPhase;
  const deviceVisible = deviceOpen && transportPhase;
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.72);
  const seekPreviewRef = useRef<number | null>(null);
  const committedSeekRef = useRef<number | null>(null);
  const elapsedTimeRef = useRef<HTMLTimeElement>(null);
  const seekInputRef = useRef<HTMLInputElement>(null);
  const smoothClockRef = useRef({
    elapsedSeconds,
    syncedAt: 0,
  });
  const queuePanelRef = useRef<HTMLElement>(null);
  const devicePanelRef = useRef<HTMLDivElement>(null);
  const queueTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deviceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const playbackKeyStateRef = useRef({
    elapsedSeconds,
    duration,
    volume,
    onSeek,
    onTogglePlayback,
    onVolumeChange,
  });
  const liked = album ? likedAlbums.has(album.id) : false;
  const displayedElapsed = seekPreview ?? elapsedSeconds;
  const progress = duration > 0 ? (displayedElapsed / duration) * 100 : 0;
  const tonearmElapsed =
    tonearmOnRecord && duration > 0
      ? duration *
        getProgressFromTonearmAngle(tonearmAngle, tonearmGeometry)
      : 0;
  const volumePercent = Math.round(volume * 100);
  const nextAlbum = queueEntries[0]?.album ?? null;
  const nextTrack = nextAlbum ? getPlaybackTrack(nextAlbum.id) : null;
  const mechanicalStatus =
    phase === "switching"
      ? "Changing record"
      : isStarting && !isPlaying
        ? "Starting playback"
      : playbackState === "buffering"
        ? "Buffering · platter remains locked"
        : playbackState === "loading" && !isPriming
          ? "Starting audio"
      : motorState === "starting"
        ? "Starting platter"
        : motorState === "changing"
          ? "Changing platter speed"
        : motorState === "braking"
          ? "Electronic braking"
          : motorState === "stopped"
        ? "Platter stopped"
        : tonearmRaised
          ? motorOn
            ? "Cue raised · platter spinning"
            : "Paused · platter stopped"
          : stylusContact && tonearmOnRecord
            ? "Now playing"
            : "Lowering cue";
  const playbackStatus = error
    ? "Playback error"
    : isPriming
      ? "Preparing"
      : isStarting
        ? "Starting"
      : playbackState === "buffering"
        ? "Buffering"
        : playbackState === "loading"
          ? "Starting"
          : playbackState === "ended"
            ? "Finished"
            : isPlaying
              ? "Now playing"
              : "Paused";
  const showTransportLoader =
    transportActive &&
    !isPlaying &&
    (isStarting ||
      isPriming ||
      playbackState === "loading" ||
      playbackState === "buffering");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      committedSeekRef.current = null;
      seekPreviewRef.current = null;
      setSeekPreview(null);
      setQueueOpen(false);
      setDeviceOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [album?.id]);

  useEffect(() => {
    const target = committedSeekRef.current;

    if (target === null) {
      return;
    }

    const reachedTarget = Math.abs(elapsedSeconds - target) <= 0.35;
    const reachedEnd =
      duration > 0 &&
      target >= duration - 0.05 &&
      playbackState === "ended";

    if (!reachedTarget && !reachedEnd && !error) {
      return;
    }

    committedSeekRef.current = null;
    seekPreviewRef.current = null;
    setSeekPreview(null);
  }, [duration, elapsedSeconds, error, playbackState, seekPreview]);

  useLayoutEffect(() => {
    smoothClockRef.current = {
      elapsedSeconds,
      syncedAt: performance.now(),
    };
  }, [album?.id, elapsedSeconds, isPlaying, speed]);

  useEffect(() => {
    if (
      !album ||
      !isPlaying ||
      duration <= 0 ||
      seekPreview !== null
    ) {
      return;
    }

    let frame: number | null = null;

    const updateSmoothTimeline = (now: number) => {
      const clock = smoothClockRef.current;
      const visualElapsed = clamp(
        clock.elapsedSeconds + (now - clock.syncedAt) / 1000,
        0,
        duration,
      );
      const visualProgress = (visualElapsed / duration) * 100;

      if (elapsedTimeRef.current) {
        elapsedTimeRef.current.textContent = formatPlaybackTime(visualElapsed);
      }
      if (seekInputRef.current) {
        seekInputRef.current.value = String(visualElapsed);
        seekInputRef.current.style.setProperty(
          "--range-progress",
          `${visualProgress}%`,
        );
      }

      if (visualElapsed < duration) {
        frame = window.requestAnimationFrame(updateSmoothTimeline);
      }
    };

    frame = window.requestAnimationFrame(updateSmoothTimeline);
    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [album, duration, isPlaying, seekPreview]);

  useEffect(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [volume]);

  useEffect(() => {
    playbackKeyStateRef.current = {
      elapsedSeconds,
      duration,
      volume,
      onSeek,
      onTogglePlayback,
      onVolumeChange,
    };
  }, [
    duration,
    elapsedSeconds,
    onSeek,
    onTogglePlayback,
    onVolumeChange,
    volume,
  ]);

  useEffect(() => {
    if (!transportPhase) {
      return;
    }

    const handlePlaybackKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            Boolean(
              target.closest(
                "input, button, textarea, select, a[href], [contenteditable='true'], [role='textbox']",
              ),
            )))
      ) {
        return;
      }

      if (event.code === "Space") {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        playbackKeyStateRef.current.onTogglePlayback();
      } else if (event.key.toLowerCase() === "m") {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        const { volume: currentVolume, onVolumeChange: changeVolume } =
          playbackKeyStateRef.current;
        if (currentVolume > 0) {
          lastVolumeRef.current = currentVolume;
          changeVolume(0);
        } else {
          changeVolume(lastVolumeRef.current || 0.72);
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 5 : -5;
        const {
          elapsedSeconds: currentElapsed,
          duration: currentDuration,
          onSeek: seekTo,
        } = playbackKeyStateRef.current;
        const target = clamp(currentElapsed + delta, 0, currentDuration);
        committedSeekRef.current = target;
        seekPreviewRef.current = target;
        setSeekPreview(target);
        seekTo(target);
      }
    };

    window.addEventListener("keydown", handlePlaybackKey);
    return () => window.removeEventListener("keydown", handlePlaybackKey);
  }, [transportPhase]);

  useEffect(() => {
    if (!queueOpen && !deviceOpen) {
      return;
    }

    const closeOpenPanel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (queueOpen) {
        setQueueOpen(false);
        window.requestAnimationFrame(() => queueTriggerRef.current?.focus());
      }
      if (deviceOpen) {
        setDeviceOpen(false);
        window.requestAnimationFrame(() => deviceTriggerRef.current?.focus());
      }
    };

    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        queueOpen &&
        !queuePanelRef.current?.contains(target) &&
        !target.closest("[data-queue-trigger]")
      ) {
        setQueueOpen(false);
      }
      if (
        deviceOpen &&
        !devicePanelRef.current?.contains(target) &&
        !target.closest("[data-device-trigger]")
      ) {
        setDeviceOpen(false);
      }
    };

    window.addEventListener("keydown", closeOpenPanel);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", closeOpenPanel);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [deviceOpen, queueOpen]);

  const openQueue = (trigger: HTMLButtonElement) => {
    queueTriggerRef.current = trigger;
    setDeviceOpen(false);
    setQueueOpen(true);
  };

  const toggleQueue = (trigger: HTMLButtonElement) => {
    queueTriggerRef.current = trigger;
    setDeviceOpen(false);
    setQueueOpen((open) => !open);
  };

  const toggleDevice = (trigger: HTMLButtonElement) => {
    deviceTriggerRef.current = trigger;
    setQueueOpen(false);
    setDeviceOpen((open) => !open);
  };

  const toggleLike = () => {
    if (!album) {
      return;
    }

    setLikedAlbums((current) => {
      const next = new Set(current);
      if (next.has(album.id)) {
        next.delete(album.id);
      } else {
        next.add(album.id);
      }
      return next;
    });
  };

  const toggleMute = () => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolumeRef.current || 0.72);
    }
  };

  const previewSeek = (value: number) => {
    seekPreviewRef.current = value;
    setSeekPreview(value);
  };

  const cancelSeekPreview = () => {
    committedSeekRef.current = null;
    seekPreviewRef.current = null;
    setSeekPreview(null);
  };

  const commitSeek = (fallbackValue: number) => {
    const value = clamp(seekPreviewRef.current ?? fallbackValue, 0, duration);
    committedSeekRef.current = value;
    seekPreviewRef.current = value;
    setSeekPreview(value);
    onSeek(value);
  };

  const previewKeyboardSeek = (event: KeyboardEvent<HTMLInputElement>) => {
    const currentValue = seekPreviewRef.current ?? displayedElapsed;
    let nextValue: number | null = null;

    if (event.key === "Home") {
      nextValue = 0;
    } else if (event.key === "End") {
      nextValue = duration;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = currentValue - 5;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = currentValue + 5;
    } else if (event.key === "PageDown") {
      nextValue = currentValue - 30;
    } else if (event.key === "PageUp") {
      nextValue = currentValue + 30;
    }

    if (nextValue === null) {
      return;
    }

    event.preventDefault();
    previewSeek(clamp(nextValue, 0, duration));
  };

  const progressStyle = {
    "--range-progress": `${progress}%`,
  } as CSSProperties;
  const volumeStyle = {
    "--range-progress": `${volumePercent}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.turntableScene}
      aria-label={`${playbackStatus}: ${track.title} by ${track.artist}`}
      aria-busy={
        phase === "loading" ||
        phase === "switching" ||
        phase === "returning" ||
        isPriming ||
        playbackState === "loading" ||
        playbackState === "buffering"
      }
      data-motor={motorOn ? "on" : "off"}
      data-motor-state={motorState}
      data-cue={tonearmRaised ? "raised" : "down"}
      data-tonearm-state={tonearmState}
      data-speed={speed}
    >
      <div className={styles.turntableShadow} aria-hidden="true" />

      <div className={styles.deck}>
        <div className={styles.deckGrain} aria-hidden="true" />
        <span className={styles.deckMark} aria-hidden="true">
          QUARTZ · DIRECT DRIVE
        </span>

        <div className={styles.hardwarePanel} aria-label="Turntable controls">
          <button
            type="button"
            className={styles.startStopButton}
            data-active={motorOn}
            onClick={onToggleMotor}
            disabled={mechanicsLocked}
            aria-label={motorOn ? "Stop platter motor" : "Start platter motor"}
            aria-pressed={motorOn}
          >
            <span className={styles.startStopCap} aria-hidden="true">
              <i />
            </span>
            <small>START · STOP</small>
          </button>

          <div
            className={styles.speedSelector}
            role="group"
            aria-label="Turntable speed"
          >
            <span>SPEED</span>
            <button
              type="button"
              data-active={speed === 33}
              onClick={() => onSetSpeed(33)}
              disabled={mechanicsLocked}
              aria-label="Select 33 and one third RPM"
              aria-pressed={speed === 33}
            >
              33
            </button>
            <button
              type="button"
              data-active={speed === 45}
              onClick={() => onSetSpeed(45)}
              disabled={mechanicsLocked}
              aria-label="Select 45 RPM"
              aria-pressed={speed === 45}
            >
              45
            </button>
          </div>

          <span
            className={styles.quartzIndicator}
            data-locked={motorState === "locked"}
            aria-hidden="true"
          >
            <i /> QUARTZ LOCK
          </span>
        </div>

        <div ref={platterRef} className={styles.platter}>
          <span className={styles.platterRim} aria-hidden="true" />
          <span
            ref={platterStrobeRef}
            className={styles.platterStrobe}
            aria-hidden="true"
          />
          <span className={styles.platterMat} aria-hidden="true" />

          <button
            ref={deckRecordRef}
            type="button"
            className={styles.deckRecord}
            data-queue-trigger
            onClick={(event) => openQueue(event.currentTarget)}
            disabled={mechanicsLocked}
            aria-label="Open this record's play queue"
            aria-controls="play-queue-panel"
            aria-expanded={queueVisible}
          >
            {album ? (
              <VinylRecord
                album={album}
                playing={motorState !== "stopped"}
                spinDuration={spinDuration}
                controlledRotation
                rotorRef={deckRotorRef}
                className={styles.deckVinyl}
                variant="platter"
              />
            ) : null}
          </button>

          <span className={styles.spindle} aria-hidden="true" />
        </div>

        <div ref={tonearmBaseRef} className={styles.tonearmBase}>
          <span className={styles.tonearmBaseRing} aria-hidden="true" />
          <span className={styles.gimbalCap} aria-hidden="true" />
          <span className={styles.antiSkateDial} aria-hidden="true">
            <i>2</i>
          </span>
          <span
            className={styles.armRest}
            data-occupied={!tonearmOnRecord}
            data-arm-rest
            aria-hidden="true"
          />
          <button
            ref={tonearmRef}
            type="button"
            className={styles.tonearm}
            data-dragging={tonearmDragging}
            data-raised={tonearmRaised}
            data-state={tonearmState}
            disabled={!album || phase !== "playing"}
            role="slider"
            aria-label="Tonearm position"
            aria-valuemin={0}
            aria-valuemax={Math.max(Math.round(duration), 1)}
            aria-valuenow={Math.round(tonearmElapsed)}
            aria-valuetext={
              !tonearmOnRecord
                ? "On arm rest"
                : `${formatPlaybackTime(tonearmElapsed)} of ${formatPlaybackTime(duration)}; cue ${tonearmRaised ? "raised" : "lowered"}`
            }
            onPointerDown={onTonearmPointerDown}
            onPointerMove={onTonearmPointerMove}
            onPointerUp={onTonearmPointerUp}
            onPointerCancel={onTonearmPointerUp}
            onKeyDown={onTonearmKeyDown}
          >
            <span
              className={styles.tonearmPivotDatum}
              data-tonearm-pivot
              aria-hidden="true"
            />
            <span className={styles.counterweight} aria-hidden="true" />
            <svg
              className={styles.armTube}
              viewBox="0 0 360 74"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M18 37 C 96 37, 137 58, 206 48 S 284 20, 333 37" />
              <path d="M20 34 C 97 34, 138 55, 205 45 S 282 17, 332 34" />
            </svg>
            <span ref={stylusRef} className={styles.stylus} aria-hidden="true">
              <span />
              <i className={styles.stylusTip} data-stylus-tip>
                <b
                  className={styles.stylusContactDatum}
                  data-stylus-contact
                />
              </i>
            </span>
          </button>

          <button
            type="button"
            className={styles.cueLever}
            onClick={onToggleCue}
            disabled={!album || phase !== "playing"}
            aria-label={tonearmRaised ? "Lower tonearm" : "Raise tonearm"}
            aria-pressed={tonearmRaised}
          >
            <span aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className={styles.stylusLamp}
          data-active={stylusLightOn}
          onClick={() => setStylusLightOn((active) => !active)}
          disabled={!album || phase !== "playing"}
          aria-label={stylusLightOn ? "Turn stylus light off" : "Turn stylus light on"}
          aria-pressed={stylusLightOn}
        />

        {album ? (
          <div
            className={styles.playerChrome}
            data-playing={transportActive}
            data-queue-open={queueVisible}
            data-device-open={deviceVisible}
          >
            <header className={styles.nowPlayingHeader}>
              <button
                type="button"
                className={styles.headerAction}
                onClick={onEject}
                disabled={phase !== "playing"}
                aria-label="Return to album shelf"
              >
                <ChevronDown aria-hidden="true" />
              </button>
              <div className={styles.headerStatus}>
                <span className={styles.statusPulse} aria-hidden="true" />
                <span role="status" aria-live="polite">
                  {error ??
                    (isPriming ? "Preparing CC0 audio study" : mechanicalStatus)}
                </span>
              </div>
              <button
                type="button"
                className={styles.headerAction}
                data-queue-trigger
                onClick={(event) => toggleQueue(event.currentTarget)}
                disabled={transportLocked}
                aria-label={queueVisible ? "Close play queue" : "Open play queue"}
                aria-expanded={queueVisible}
                aria-controls="play-queue-panel"
              >
                <ListMusic aria-hidden="true" />
              </button>
            </header>

            <section
              className={styles.playerContext}
              aria-labelledby="now-playing-title"
            >
              <div className={styles.contextArtwork} aria-hidden="true">
                <Image
                  src={album.cover}
                  alt=""
                  fill
                  sizes="96px"
                  draggable={false}
                />
              </div>
              <div className={styles.contextCopy}>
                <div className={styles.contextEyebrow}>
                  <span>
                    {isPlaying ? "Playing CC0 audio study" : mechanicalStatus}
                  </span>
                  <span
                    className={styles.qualityBadge}
                    title="Public-domain preview audio"
                  >
                    CC0 audio study
                  </span>
                </div>
                <h1 id="now-playing-title" className={styles.contextTitle}>
                  {track.title}
                </h1>
                <p className={styles.contextArtist}>{track.artist}</p>
                <p className={styles.contextMeta}>
                  Source sleeve: {album.title}{" "}
                  <span aria-hidden="true">&bull;</span>{" "}
                  {speed === 33 ? "33⅓" : "45"} RPM
                </p>
              </div>
              <div className={styles.contextActionRow}>
                <button
                  type="button"
                  className={styles.likeLarge}
                  data-active={liked}
                  onClick={toggleLike}
                  disabled={transportLocked}
                  aria-label={liked ? "Remove from liked music" : "Save to liked music"}
                  aria-pressed={liked}
                >
                  {liked ? <Check aria-hidden="true" /> : <Heart aria-hidden="true" />}
                  <span>{liked ? "Saved" : "Save"}</span>
                </button>
                {nextAlbum ? (
                  <button
                    type="button"
                    className={styles.upNextButton}
                    data-queue-trigger
                    onClick={(event) => openQueue(event.currentTarget)}
                    disabled={transportLocked}
                    aria-label={`Open queue. Up next: ${nextTrack?.title} by ${nextTrack?.artist}, paired with the ${nextAlbum.title} sleeve`}
                    aria-controls="play-queue-panel"
                    aria-expanded={queueVisible}
                  >
                    <span className={styles.upNextArtwork} aria-hidden="true">
                      <Image
                        src={nextAlbum.cover}
                        alt=""
                        fill
                        sizes="48px"
                        draggable={false}
                      />
                    </span>
                    <span className={styles.upNextText}>
                      <small>Up next</small>
                      <strong>{nextAlbum.title}</strong>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </section>

            <footer className={styles.playerBar}>
              <div className={styles.barTrack}>
                <span className={styles.barArtwork} aria-hidden="true">
                  <Image
                    src={album.cover}
                    alt=""
                    fill
                    sizes="56px"
                    draggable={false}
                  />
                </span>
                <span className={styles.barIdentity}>
                  <strong>{track.title}</strong>
                  <span>{track.artist} · CC0 audio study</span>
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  data-active={liked}
                  onClick={toggleLike}
                  disabled={transportLocked}
                  aria-label={liked ? "Remove from liked music" : "Save to liked music"}
                  aria-pressed={liked}
                >
                  <Heart fill={liked ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.barCenter}>
                <div className={styles.transportControls} role="group" aria-label="Playback controls">
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={shuffleEnabled}
                    onClick={onToggleShuffle}
                    disabled={transportLocked}
                    aria-label={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
                    aria-pressed={shuffleEnabled}
                  >
                    <Shuffle aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={onPrevious}
                    disabled={transportLocked}
                    aria-label="Previous CC0 track pairing"
                  >
                    <SkipBack fill="currentColor" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={onTogglePlayback}
                    disabled={transportLocked}
                    aria-label={`${transportActive ? "Pause" : "Play"} ${track.title}`}
                    aria-keyshortcuts="Space"
                  >
                    {showTransportLoader ? (
                      <LoaderCircle
                        className={styles.transportSpinner}
                        aria-hidden="true"
                      />
                    ) : transportActive ? (
                      <Pause fill="currentColor" aria-hidden="true" />
                    ) : (
                      <Play fill="currentColor" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onNext(shuffleEnabled)}
                    disabled={transportLocked || queueEntries.length === 0}
                    aria-label="Next CC0 track pairing"
                  >
                    <SkipForward fill="currentColor" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={repeatMode !== "off"}
                    data-repeat={repeatMode}
                    onClick={onCycleRepeat}
                    disabled={transportLocked}
                    aria-label={
                      repeatMode === "off"
                        ? "Repeat is off. Activate for repeat all"
                        : repeatMode === "all"
                          ? "Repeating all tracks. Activate for repeat one"
                          : "Repeating the current track. Activate to turn repeat off"
                    }
                    aria-pressed={repeatMode !== "off"}
                  >
                    <Repeat2 aria-hidden="true" />
                    {repeatMode === "one" ? <small aria-hidden="true">1</small> : null}
                  </button>
                </div>
                <div className={styles.timeline}>
                  <time ref={elapsedTimeRef}>
                    {formatPlaybackTime(displayedElapsed)}
                  </time>
                  <input
                    ref={seekInputRef}
                    type="range"
                    className={styles.playerSeek}
                    min="0"
                    max={duration}
                    step="0.25"
                    value={Math.min(displayedElapsed, duration)}
                    style={progressStyle}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      previewSeek(Number(event.currentTarget.value));
                    }}
                    onInput={(event) =>
                      previewSeek(Number(event.currentTarget.value))
                    }
                    onChange={(event) =>
                      previewSeek(Number(event.currentTarget.value))
                    }
                    onPointerUp={(event) => {
                      commitSeek(Number(event.currentTarget.value));
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    onPointerCancel={cancelSeekPreview}
                    onKeyDown={previewKeyboardSeek}
                    onKeyUp={(event) => {
                      if (
                        event.key.startsWith("Arrow") ||
                        event.key === "Home" ||
                        event.key === "End" ||
                        event.key === "PageUp" ||
                        event.key === "PageDown"
                      ) {
                        commitSeek(Number(event.currentTarget.value));
                      }
                    }}
                    onBlur={(event) => {
                      if (seekPreview !== null) {
                        commitSeek(Number(event.currentTarget.value));
                      }
                    }}
                    disabled={seekLocked}
                    aria-label="Playback position"
                    aria-valuetext={`${formatPlaybackTime(displayedElapsed)} of ${formatPlaybackTime(duration)}`}
                  />
                  <time>{formatPlaybackTime(duration)}</time>
                </div>
              </div>

              <div className={styles.barUtility}>
                <button
                  type="button"
                  className={styles.speedButton}
                  onClick={onToggleSpeed}
                  disabled={mechanicsLocked}
                  aria-label={`Change turntable speed. Current setting ${speed === 33 ? "33 and one third" : "45"} RPM. Audio remains at normal speed.`}
                >
                  {speed === 33 ? "33⅓" : "45"}
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  data-active={queueVisible}
                  data-queue-trigger
                  onClick={(event) => toggleQueue(event.currentTarget)}
                  disabled={transportLocked}
                  aria-label={queueVisible ? "Close queue" : "Open queue"}
                  aria-expanded={queueVisible}
                  aria-controls="play-queue-panel"
                >
                  <ListMusic aria-hidden="true" />
                </button>
                <div className={styles.deviceMenu}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={deviceVisible}
                    data-device-trigger
                    onClick={(event) => toggleDevice(event.currentTarget)}
                    disabled={transportLocked}
                    aria-label="Playback output: this browser"
                    aria-expanded={deviceVisible}
                    aria-controls="playback-output-panel"
                  >
                    <MonitorSpeaker aria-hidden="true" />
                  </button>
                  {deviceVisible ? (
                    <div
                      ref={devicePanelRef}
                      id="playback-output-panel"
                      className={styles.devicePopover}
                      role="dialog"
                      aria-label="Playback output"
                    >
                      <strong>Playback output</strong>
                      <div className={styles.deviceOption} data-active="true">
                        <MonitorSpeaker aria-hidden="true" />
                        <span>
                          <strong>This browser</strong>
                          <small>Current web player</small>
                        </span>
                        <Check aria-hidden="true" />
                      </div>
                      <p className={styles.deviceNote}>
                        Speaker selection follows your browser and system audio settings.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className={styles.volumeControl}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={toggleMute}
                    aria-label={volume > 0 ? "Mute" : "Unmute"}
                    aria-keyshortcuts="M"
                  >
                    {volume > 0 ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                  </button>
                  <input
                    type="range"
                    className={styles.volumeSlider}
                    min="0"
                    max="100"
                    value={volumePercent}
                    style={volumeStyle}
                    onInput={(event) =>
                      onVolumeChange(Number(event.currentTarget.value) / 100)
                    }
                    aria-label="Volume"
                    aria-valuetext={`${volumePercent} percent`}
                  />
                </div>
              </div>
            </footer>

            {queueVisible ? (
              <aside
                ref={queuePanelRef}
                id="play-queue-panel"
                className={styles.queueDrawer}
                aria-label="Play queue"
              >
                <div className={styles.queueHeader}>
                  <div>
                    <small>Playing next</small>
                    <strong>Queue</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      setQueueOpen(false);
                      window.requestAnimationFrame(() =>
                        queueTriggerRef.current?.focus(),
                      );
                    }}
                    aria-label="Close queue panel"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <span className={styles.queueSectionLabel}>Now playing</span>
                <div className={styles.queueCurrent}>
                  <span className={styles.queueArtwork} aria-hidden="true">
                    <Image src={album.cover} alt="" fill sizes="52px" draggable={false} />
                  </span>
                  <span className={styles.queueCopy}>
                    <strong>{track.title}</strong>
                    <span>{track.artist} · CC0 audio study</span>
                  </span>
                  <span
                    className={styles.playingBars}
                    data-playing={isPlaying}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <span className={styles.queueSectionLabel}>Next in queue</span>
                <div className={styles.queueList}>
                  {queueEntries.length > 0 ? (
                    queueEntries.map((entry, queueIndex) => {
                      const queuedTrack = getPlaybackTrack(entry.album.id);

                      return (
                        <button
                          key={entry.album.id}
                          type="button"
                          className={styles.queueItem}
                          onClick={() => {
                            onSelectAlbum(entry.index, true);
                            setQueueOpen(false);
                          }}
                          aria-label={`Play ${queuedTrack.title} by ${queuedTrack.artist}, paired with the ${entry.album.title} sleeve`}
                        >
                          <span className={styles.queuePosition}>{queueIndex + 1}</span>
                          <span className={styles.queueArtwork} aria-hidden="true">
                            <Image src={entry.album.cover} alt="" fill sizes="48px" draggable={false} />
                          </span>
                          <span className={styles.queueCopy}>
                            <strong>{queuedTrack.title}</strong>
                            <span>{queuedTrack.artist} · {entry.album.title} sleeve</span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className={styles.queueEmpty}>End of queue</p>
                  )}
                </div>
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MusicPlayerExperience() {
  const {
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
    registerTransportController,
  } = usePlayback();
  const restoredIndex = hasPlayback ? currentAlbumIndex : null;
  const restoredNativeRpm = currentAlbum.vinyl.rpm ?? 33.333;
  const restoredRpm = restoredNativeRpm * playbackRate;
  const restoredSpeed: PlaybackSpeed =
    Math.abs(restoredRpm - 45) < Math.abs(restoredRpm - (33 + 1 / 3))
      ? 45
      : 33;
  const restoredTonearmAngle = hasPlayback
    ? getTonearmAngleFromProgress(duration > 0 ? currentTime / duration : 0)
    : TONEARM_HOME_ANGLE;
  const initialMotorRpm =
    hasPlayback && playIntent ? getPlaybackRpm(restoredSpeed) : 0;
  const rootRef = useRef<HTMLElement>(null);
  const rackRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shelfItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sleeveRef = useRef<HTMLButtonElement>(null);
  const floatingRecordRef = useRef<HTMLButtonElement>(null);
  const platterRef = useRef<HTMLDivElement>(null);
  const platterStrobeRef = useRef<HTMLSpanElement>(null);
  const floatingRotorRef = useRef<HTMLSpanElement>(null);
  const deckRecordRef = useRef<HTMLButtonElement>(null);
  const deckRotorRef = useRef<HTMLSpanElement>(null);
  const tonearmBaseRef = useRef<HTMLDivElement>(null);
  const tonearmRef = useRef<HTMLButtonElement>(null);
  const stylusRef = useRef<HTMLSpanElement>(null);
  const sequenceRef = useRef<gsap.core.Timeline | null>(null);
  const mechanicsSequenceRef = useRef<gsap.core.Timeline | null>(null);
  const motorRpmRef = useRef({
    value: initialMotorRpm,
  });
  const motorRampRef = useRef({
    from: initialMotorRpm,
    target: initialMotorRpm,
    startedAt: 0,
    duration: 0,
  });
  const motorOnRef = useRef(hasPlayback && playIntent);
  const motorStateRef = useRef<MotorState>(
    hasPlayback && playIntent ? "locked" : "stopped",
  );
  const tonearmRaisedRef = useRef(!playIntent);
  const tonearmStateRef = useRef<TonearmState>(
    playIntent ? "tracking" : hasPlayback ? "raised" : "parked",
  );
  const tonearmOperationRef = useRef(0);
  const playIntentStateRef = useRef(playIntent);
  const playbackClockRef = useRef({
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    syncedAt: 0,
  });
  const platterAngleRef = useRef(0);
  const platterStrobeAngleRef = useRef(0);
  const shelfTweenRef = useRef<gsap.core.Tween | null>(null);
  const shelfLayoutFrameRef = useRef<number | null>(null);
  const shelfMetricsRef = useRef({
    valid: false,
    axis: "x" as ShelfAxis,
    viewportWidth: 0,
    viewportHeight: 0,
    sleeveSize: 320,
    pitch: 82,
    visibleRadius: 6,
  });
  const positionRef = useRef({
    value: restoredIndex ?? INITIAL_ALBUM_INDEX,
  });
  const removedIndexRef = useRef<number | null>(restoredIndex);
  const gapProgressRef = useRef({ value: restoredIndex === null ? 0 : 1 });
  const phaseRef = useRef<PlayerPhase>(
    restoredIndex === null ? "browsing" : "playing",
  );
  const gestureRef = useRef<GestureState>({
    pointerId: null,
    axis: "y",
    pitch: 82,
    startCoordinate: 0,
    lastCoordinate: 0,
    lastTime: 0,
    velocity: 0,
    startPosition: restoredIndex ?? INITIAL_ALBUM_INDEX,
    tapIndex: null,
    moved: false,
  });
  const tonearmGestureRef = useRef<TonearmGestureState>({
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
    grabOffset: 0,
    resumeOnDrop: false,
  });
  const tonearmAngleRef = useRef(restoredTonearmAngle);
  const tonearmGeometryRef = useRef<TonearmGeometry>(
    FALLBACK_TONEARM_GEOMETRY,
  );
  const wheelSnapRef = useRef<number | null>(null);

  const [phase, setPhaseState] = useState<PlayerPhase>(
    restoredIndex === null ? "browsing" : "playing",
  );
  const [activeIndex, setActiveIndex] = useState(
    restoredIndex ?? INITIAL_ALBUM_INDEX,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    restoredIndex,
  );
  const [loadedIndex, setLoadedIndex] = useState<number | null>(restoredIndex);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motorOn, setMotorOnState] = useState(hasPlayback && playIntent);
  const [motorState, setMotorState] = useState<MotorState>(
    hasPlayback && playIntent ? "locked" : "stopped",
  );
  const [speed, setSpeed] = useState<PlaybackSpeed>(restoredSpeed);
  const [tonearmAngle, setTonearmAngle] = useState(restoredTonearmAngle);
  const [tonearmRaised, setTonearmRaised] = useState(!playIntent);
  const [stylusContact, setStylusContact] = useState(playIntent);
  const [tonearmDragging, setTonearmDragging] = useState(false);
  const [tonearmState, setTonearmState] = useState<TonearmState>(
    playIntent ? "tracking" : hasPlayback ? "raised" : "parked",
  );
  const [tonearmGeometry, setTonearmGeometry] = useState<TonearmGeometry>(
    FALLBACK_TONEARM_GEOMETRY,
  );
  const transportActionsRef = useRef<{
    play: () => void;
    pause: () => void;
    previous: () => void;
    next: (shuffle: boolean) => void;
    seek: (seconds: number) => void;
    ended: () => void;
  }>({
    play: () => undefined,
    pause: () => undefined,
    previous: () => undefined,
    next: () => undefined,
    seek: () => undefined,
    ended: () => undefined,
  });

  const selectedAlbum =
    selectedIndex === null ? null : vinylAlbums[selectedIndex];
  const selectedTrack = selectedAlbum
    ? getPlaybackTrack(selectedAlbum.id)
    : track;
  const loadedAlbum = loadedIndex === null ? null : vinylAlbums[loadedIndex];
  const loadedTrack = loadedAlbum ? getPlaybackTrack(loadedAlbum.id) : track;
  const transportActive = !error && playIntent;
  const transportStarting =
    transportActive &&
    (!isPlaying ||
      playbackState === "loading" ||
      playbackState === "buffering");

  const setMotorOn = useCallback((nextMotorOn: boolean) => {
    motorOnRef.current = nextMotorOn;
    setMotorOnState(nextMotorOn);
  }, []);

  const setTonearmMechanicState = useCallback((nextState: TonearmState) => {
    tonearmStateRef.current = nextState;
    setTonearmState(nextState);
  }, []);

  const requestPlay = useCallback(() => {
    playIntentStateRef.current = true;
    play();
  }, [play]);

  const requestPause = useCallback(() => {
    playIntentStateRef.current = false;
    pause();
  }, [pause]);

  const measureTonearmGeometry = useCallback(() => {
    const record = deckRecordRef.current;
    const base = tonearmBaseRef.current;
    const arm = tonearmRef.current;
    const headshell = stylusRef.current;
    const stylusTip = headshell?.querySelector<HTMLElement>(
      "[data-stylus-tip]",
    );
    const pivotDatum = arm?.querySelector<HTMLElement>(
      "[data-tonearm-pivot]",
    );
    const contactDatum = stylusTip?.querySelector<HTMLElement>(
      "[data-stylus-contact]",
    );

    if (
      !record ||
      !base ||
      !arm ||
      !headshell ||
      !stylusTip ||
      !pivotDatum ||
      !contactDatum
    ) {
      return FALLBACK_TONEARM_GEOMETRY;
    }

    const recordBounds = record.getBoundingClientRect();
    const baseBounds = base.getBoundingClientRect();
    const baseScaleX = base.offsetWidth > 0
      ? baseBounds.width / base.offsetWidth
      : 1;
    const baseScaleY = base.offsetHeight > 0
      ? baseBounds.height / base.offsetHeight
      : 1;
    const pivotBounds = pivotDatum.getBoundingClientRect();
    const contactBounds = contactDatum.getBoundingClientRect();
    const pivotX = pivotBounds.left + pivotBounds.width / 2;
    const pivotY = pivotBounds.top + pivotBounds.height / 2;
    const recordX = recordBounds.left + recordBounds.width / 2;
    const recordY = recordBounds.top + recordBounds.height / 2;
    // Read the real rendered contact point, including the angled needle. The
    // cue lift is a local translate on the headshell; remove that translate so
    // the groove model always describes the lowered stylus.
    const currentYaw = Number.parseFloat(
      String(gsap.getProperty(arm, "rotationZ")),
    ) || 0;
    const [stylusTranslateX = "0", stylusTranslateY = "0"] =
      getComputedStyle(headshell).translate.split(" ");
    const translateX = Number.parseFloat(stylusTranslateX) || 0;
    const translateY = Number.parseFloat(stylusTranslateY) || 0;
    const yawRadians = (currentYaw * Math.PI) / 180;
    const translatedScreenX =
      translateX * baseScaleX * Math.cos(yawRadians) -
      translateY * baseScaleY * Math.sin(yawRadians);
    const translatedScreenY =
      translateX * baseScaleX * Math.sin(yawRadians) +
      translateY * baseScaleY * Math.cos(yawRadians);
    const loweredTipX =
      contactBounds.left + contactBounds.width / 2 - translatedScreenX;
    const loweredTipY =
      contactBounds.top + contactBounds.height / 2 - translatedScreenY;
    const tipVectorX = loweredTipX - pivotX;
    const tipVectorY = loweredTipY - pivotY;
    const armLength = Math.hypot(tipVectorX, tipVectorY);
    const neutralTipAngle = normalizeTonearmAngle(
      (Math.atan2(tipVectorY, tipVectorX) * 180) / Math.PI - currentYaw,
    );
    const recordDiameter = Math.min(recordBounds.width, recordBounds.height);
    const outerGrooveRadius = recordDiameter * 0.46;
    const innerGrooveRadius = recordDiameter * 0.2;
    const leadInAngle = getTonearmYawForRadius({
      pivotX,
      pivotY,
      recordX,
      recordY,
      armLength,
      grooveRadius: outerGrooveRadius,
      neutralTipAngle,
      preferredAngle: TONEARM_PLAY_ANGLE,
    });
    const runoutAngle = getTonearmYawForRadius({
      pivotX,
      pivotY,
      recordX,
      recordY,
      armLength,
      grooveRadius: innerGrooveRadius,
      neutralTipAngle,
      preferredAngle: leadInAngle ?? TONEARM_END_ANGLE,
    });
    const armRest = base.querySelector<HTMLElement>("[data-arm-rest]");
    const armRestBounds = armRest?.getBoundingClientRect();
    const measuredHomeAngle =
      armRestBounds && armRestBounds.width > 0 && armRestBounds.height > 0
      ? normalizeTonearmAngle(
          (Math.atan2(
            armRestBounds.top + armRestBounds.height / 2 - pivotY,
            armRestBounds.left + armRestBounds.width / 2 - pivotX,
          ) *
            180) /
            Math.PI -
            neutralTipAngle,
        )
      : null;
    const homeAngle =
      measuredHomeAngle !== null &&
      measuredHomeAngle > -130 &&
      measuredHomeAngle < 5
        ? measuredHomeAngle
        : TONEARM_HOME_ANGLE;

    if (
      leadInAngle === null ||
      runoutAngle === null ||
      !Number.isFinite(leadInAngle) ||
      !Number.isFinite(runoutAngle) ||
      Math.abs(runoutAngle - leadInAngle) < 1
    ) {
      return {
        ...FALLBACK_TONEARM_GEOMETRY,
        homeAngle,
      };
    }

    return {
      homeAngle,
      leadInAngle,
      runoutAngle,
      minimumAngle: Math.min(homeAngle, leadInAngle, runoutAngle) - 4,
      maximumAngle: Math.max(homeAngle, leadInAngle, runoutAngle) + 4,
      measured: true,
    };
  }, []);

  const updatePhase = useCallback((nextPhase: PlayerPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const layoutShelf = useCallback(() => {
    const position = positionRef.current.value;
    const axis = getShelfAxis();
    const removedIndex = removedIndexRef.current;
    const gapProgress = gapProgressRef.current.value;
    const orientation = axis === "x" ? "horizontal" : "vertical";

    if (
      rackRef.current &&
      rackRef.current.dataset.orientation !== orientation
    ) {
      rackRef.current.dataset.orientation = orientation;
    }
    if (rootRef.current && rootRef.current.dataset.browseAxis !== axis) {
      rootRef.current.dataset.browseAxis = axis;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cachedMetrics = shelfMetricsRef.current;

    if (
      !cachedMetrics.valid ||
      cachedMetrics.axis !== axis ||
      cachedMetrics.viewportWidth !== viewportWidth ||
      cachedMetrics.viewportHeight !== viewportHeight
    ) {
      const referenceSlot = slotRefs.current.find(
        (slot): slot is HTMLButtonElement => Boolean(slot),
      );
      const sleeveSize = referenceSlot?.offsetWidth ?? cachedMetrics.sleeveSize;
      const pitch = getShelfPitch(axis, sleeveSize);

      shelfMetricsRef.current = {
        valid: Boolean(referenceSlot),
        axis,
        viewportWidth,
        viewportHeight,
        sleeveSize,
        pitch,
        visibleRadius:
          (axis === "x" ? viewportWidth : viewportHeight) / (pitch * 2) +
          (axis === "x" ? 1.35 : 1.6),
      };
    }

    const { pitch, sleeveSize, visibleRadius } = shelfMetricsRef.current;
    const velocityTilt = clamp(
      gestureRef.current.velocity / 2400,
      -1,
      1,
    ) * (axis === "x" ? 3 : 1.2);

    shelfItemRefs.current.forEach((slot) => {
      if (!slot) {
        return;
      }

      const albumIndex = Number(slot.dataset.recordIndex);
      const cycle = Number(slot.dataset.shelfCycle);

      if (albumIndex === removedIndex && cycle === 0) {
        return;
      }

      const wrappedRelative =
        getShelfRelative(albumIndex, position, axis) +
        cycle * vinylAlbums.length;
      const removalSide =
        removedIndex === null
          ? 0
          : getShelfRelative(albumIndex, removedIndex, axis) +
            cycle * vinylAlbums.length;
      const relative =
        wrappedRelative +
        (removalSide < 0
          ? -gapProgress * 0.34
          : removalSide > 0
            ? gapProgress * 0.34
            : 0);
      const distance = Math.abs(relative);
      const visible = distance <= visibleRadius;
      const wasVisible = slot.dataset.layoutVisible === "true";

      if (!visible) {
        if (wasVisible || slot.dataset.layoutVisible !== "false") {
          slot.dataset.layoutVisible = "false";
          gsap.set(slot, { autoAlpha: 0, visibility: "hidden" });
        }
        return;
      }

      if (!wasVisible) {
        slot.dataset.layoutVisible = "true";
        gsap.set(slot, { autoAlpha: 1, visibility: "visible" });
      }
      const focus = 1 - clamp(distance, 0, 1);
      const veil = clamp((distance - 1) * 0.045, 0, 0.22);
      const depthBlur =
        axis === "x"
          ? clamp((distance - 3.75) * 3.2, 0, 6)
          : relative > 2.2
            ? clamp((relative - 2.2) * 4.2, 0, 12)
            : relative < -3.25
              ? clamp((-relative - 3.25) * 1.9, 0, 4.5)
              : 0;
      const rotation = getShelfRotation(relative, axis, reducedMotion);
      const centreVelocityLock =
        axis === "x" ? clamp(distance / 0.5, 0, 1) : 1;
      const slotRotationX =
        axis === "y" ? rotation.rotationX + velocityTilt : 0;
      const slotRotationY =
        axis === "x"
          ? rotation.rotationY + velocityTilt * centreVelocityLock
          : 0;
      const stackSide = relative < -0.08
        ? "above"
        : relative > 0.08
          ? "below"
          : "focus";
      if (slot.dataset.stackSide !== stackSide) {
        slot.dataset.stackSide = stackSide;
      }
      setStylePropertyIfChanged(slot, "--shelf-veil", veil.toFixed(3));
      setStylePropertyIfChanged(
        slot,
        "--face-blur",
        `${depthBlur.toFixed(2)}px`,
      );
      setStylePropertyIfChanged(
        slot,
        "--face-brightness",
        `${clamp(
          (axis === "x" ? 1.035 : 1.025) -
            distance * (axis === "x" ? 0.025 : 0.034),
          axis === "x" ? 0.86 : 0.81,
          1.035,
        ).toFixed(3)}`,
      );

      gsap.set(
        slot,
        axis === "x"
          ? {
              x: relative * pitch,
              y: 0,
              z: -distance * sleeveSize * 0.012 + focus * sleeveSize * 0.018,
              rotationX: 0,
              rotationY: slotRotationY,
              rotationZ: 0,
              scale: 1,
              zIndex: Math.round(200 - distance * 12),
            }
          : {
              x:
                Math.sin(albumIndex * 1.73) *
                Math.min(4, sleeveSize * 0.012),
              y: relative * pitch,
              z:
                clamp(relative, -5.2, 3.2) * sleeveSize * 0.04 +
                focus * sleeveSize * 0.045,
              rotationX: slotRotationX,
              rotationY: 0,
              rotationZ: reducedMotion
                ? 0
                : Math.sin(albumIndex * 2.17) * 0.7,
              scale: 1,
              zIndex: Math.round(100 + relative * 10),
            },
      );
    });
  }, [reducedMotion]);

  const scheduleShelfLayout = useCallback(() => {
    if (shelfLayoutFrameRef.current !== null) {
      return;
    }

    shelfLayoutFrameRef.current = window.requestAnimationFrame(() => {
      shelfLayoutFrameRef.current = null;
      layoutShelf();
    });
  }, [layoutShelf]);

  const animateShelfTo = useCallback(
    (index: number, onComplete?: () => void) => {
      const target = getNearestVirtualPosition(
        index,
        positionRef.current.value,
      );
      const distance = Math.abs(positionRef.current.value - target);

      shelfTweenRef.current?.kill();
      shelfTweenRef.current = gsap.to(positionRef.current, {
        value: target,
        duration: reducedMotion ? 0.12 : clamp(0.3 + distance * 0.08, 0.34, 0.66),
        ease: reducedMotion ? "power1.out" : "expo.out",
        overwrite: true,
        onUpdate: () => {
          gestureRef.current.velocity *= 0.82;
          layoutShelf();
        },
        onComplete: () => {
          gestureRef.current.velocity = 0;
          positionRef.current.value = wrapAlbumIndex(target);
          layoutShelf();
          onComplete?.();
        },
      });
    },
    [layoutShelf, reducedMotion],
  );

  const focusAlbum = useCallback(
    (index: number, extract = false) => {
      if (phaseRef.current !== "browsing") {
        return;
      }

      const target = wrapAlbumIndex(index);
      const virtualTarget = getNearestVirtualPosition(
        target,
        positionRef.current.value,
      );
      setActiveIndex(target);

      const beginExtraction = () => {
        if (!extract || phaseRef.current !== "browsing") {
          return;
        }

        setSelectedIndex(target);
        updatePhase("extracting");
      };

      if (Math.abs(positionRef.current.value - virtualTarget) < 0.025) {
        positionRef.current.value = target;
        layoutShelf();
        beginExtraction();
        return;
      }

      animateShelfTo(target, () => {
        beginExtraction();
      });
    },
    [animateShelfTo, layoutShelf, updatePhase],
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);

    updatePreference();
    preference.addEventListener("change", updatePreference);

    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useLayoutEffect(() => {
    let frame: number | null = null;

    const syncGeometry = () => {
      const nextGeometry = measureTonearmGeometry();
      tonearmGeometryRef.current = nextGeometry;
      setTonearmGeometry(nextGeometry);

      if (tonearmStateRef.current === "parked") {
        tonearmAngleRef.current = nextGeometry.homeAngle;
        setTonearmAngle(nextGeometry.homeAngle);
        if (tonearmRef.current) {
          gsap.set(tonearmRef.current, {
            rotationZ: nextGeometry.homeAngle,
          });
        }
      } else if (
        tonearmStateRef.current === "raised" ||
        tonearmStateRef.current === "tracking"
      ) {
        // Orientation/viewport changes alter both the pivot distance and the
        // required groove angles. Reproject the current media position onto
        // the freshly measured geometry instead of keeping a desktop yaw.
        const playbackClock = playbackClockRef.current;
        const progress =
          playbackClock.duration > 0
            ? playbackClock.currentTime / playbackClock.duration
            : 0;
        const responsiveAngle = getTonearmAngleFromProgress(
          progress,
          nextGeometry,
        );
        tonearmAngleRef.current = responsiveAngle;
        setTonearmAngle(responsiveAngle);
        if (tonearmRef.current) {
          gsap.set(tonearmRef.current, { rotationZ: responsiveAngle });
        }
      }
    };

    const scheduleGeometry = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        syncGeometry();
      });
    };

    scheduleGeometry();
    window.addEventListener("resize", scheduleGeometry);

    return () => {
      window.removeEventListener("resize", scheduleGeometry);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [loadedIndex, measureTonearmGeometry, phase]);

  useLayoutEffect(() => {
    playbackClockRef.current = {
      currentTime,
      duration,
      isPlaying,
      playbackRate,
      syncedAt: performance.now(),
    };
  }, [currentTime, duration, isPlaying, playbackRate]);

  useLayoutEffect(() => {
    playIntentStateRef.current = playIntent;
  }, [playIntent]);

  useLayoutEffect(() => {
    const targetRpm = motorOn ? getPlaybackRpm(speed) : 0;
    const currentRpm = motorRpmRef.current.value;
    const speedChange = motorOn && currentRpm > 0.5;
    const durationSeconds = reducedMotion
      ? 0
      : motorOn
        ? speedChange
          ? MOTOR_SPEED_CHANGE_DURATION
          : MOTOR_START_DURATION
        : MOTOR_STOP_DURATION;
    const transitionState: MotorState = motorOn
      ? speedChange
        ? "changing"
        : "starting"
      : currentRpm > 0.5
        ? "braking"
        : "stopped";

    motorRampRef.current = {
      from: currentRpm,
      target: targetRpm,
      startedAt: performance.now(),
      duration: durationSeconds,
    };

    if (durationSeconds === 0 || Math.abs(currentRpm - targetRpm) < 0.001) {
      motorRpmRef.current.value = targetRpm;
      const settledState: MotorState = motorOn ? "locked" : "stopped";
      motorStateRef.current = settledState;
      setMotorState(settledState);
      return;
    }

    motorStateRef.current = transitionState;
    setMotorState(transitionState);
  }, [motorOn, reducedMotion, speed]);

  useLayoutEffect(() => {
    let syncedFloatingRotor: HTMLSpanElement | null = null;
    let syncedDeckRotor: HTMLSpanElement | null = null;
    let syncedStrobe: HTMLSpanElement | null = null;
    let frame: number | null = null;
    let previousTime = performance.now();

    const updatePhysicalRotation = (now: number, advance: boolean) => {
      const rawDeltaSeconds = advance
        ? Math.max(now - previousTime, 0) / 1000
        : 0;
      // Low frame rates must not slow the platter. Only suppress a true
      // background-tab suspension so returning to the page never causes a
      // distracting multi-revolution jump.
      const deltaSeconds =
        rawDeltaSeconds > MOTOR_SUSPEND_THRESHOLD ? 0 : rawDeltaSeconds;
      previousTime = now;
      const ramp = motorRampRef.current;
      const rampProgress =
        ramp.duration <= 0
          ? 1
          : clamp((now - ramp.startedAt) / (ramp.duration * 1000), 0, 1);
      const easedRampProgress = 1 - (1 - rampProgress) ** 3;
      const currentRpm =
        ramp.from + (ramp.target - ramp.from) * easedRampProgress;
      motorRpmRef.current.value = currentRpm;

      if (rampProgress >= 1) {
        motorRpmRef.current.value = ramp.target;
        const settledState: MotorState =
          ramp.target > 0 ? "locked" : "stopped";
        if (motorStateRef.current !== settledState) {
          motorStateRef.current = settledState;
          setMotorState(settledState);
        }
      }

      const isRotating = !reducedMotion && Math.abs(currentRpm) >= 0.001;

      if (isRotating && deltaSeconds > 0) {
        platterAngleRef.current =
          (platterAngleRef.current + currentRpm * 6 * deltaSeconds) % 360;
        platterStrobeAngleRef.current =
          (platterStrobeAngleRef.current +
            (currentRpm - ramp.target) * 6 * deltaSeconds) %
            360;
      }

      const playbackClock = playbackClockRef.current;
      if (
        isRotating &&
        playbackClock.isPlaying &&
        playbackClock.duration > 0 &&
        phaseRef.current === "playing" &&
        tonearmStateRef.current === "tracking" &&
        tonearmGestureRef.current.pointerId === null &&
        tonearmRef.current
      ) {
        const smoothElapsed = clamp(
          playbackClock.currentTime +
            ((now - playbackClock.syncedAt) / 1000) *
              playbackClock.playbackRate,
          0,
          playbackClock.duration,
        );
        const smoothAngle = getTonearmAngleFromProgress(
          smoothElapsed / playbackClock.duration,
          tonearmGeometryRef.current,
        );

        tonearmAngleRef.current = smoothAngle;
        gsap.set(tonearmRef.current, { rotationZ: smoothAngle });
      }

      // Keep newly mounted floating/deck rotors phase-aligned even while the
      // motor is stopped. Otherwise a replacement record renders at 0° and
      // snaps to the preserved platter angle on the first powered frame.
      const rotation = platterAngleRef.current;
      if (
        floatingRotorRef.current &&
        phaseRef.current !== "playing" &&
        phaseRef.current !== "switching" &&
        (isRotating || floatingRotorRef.current !== syncedFloatingRotor)
      ) {
        floatingRotorRef.current.style.transform = `rotate(${rotation}deg)`;
      }
      if (
        deckRotorRef.current &&
        (isRotating || deckRotorRef.current !== syncedDeckRotor)
      ) {
        deckRotorRef.current.style.transform = `rotate(${rotation}deg)`;
      }
      if (
        platterStrobeRef.current &&
        (isRotating || platterStrobeRef.current !== syncedStrobe)
      ) {
        platterStrobeRef.current.style.transform = `rotate(${platterStrobeAngleRef.current}deg)`;
      }

      syncedFloatingRotor = floatingRotorRef.current;
      syncedDeckRotor = deckRotorRef.current;
      syncedStrobe = platterStrobeRef.current;

      // Keep one authoritative ticker alive for the lifetime of the scene.
      // Restarting it on speed/motor state changes creates a visible frozen
      // frame followed by a catch-up jump at high refresh rates.
      frame = window.requestAnimationFrame((time) => {
        updatePhysicalRotation(time, true);
      });
    };

    updatePhysicalRotation(previousTime, false);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (loadedIndex === null) {
      return;
    }

    // The deck selector controls the visual platter only. A normal music
    // transport must not pitch or time-stretch the CC0 preview when the user
    // inspects 33/45 RPM behavior.
    setPlaybackRate(1);
  }, [loadedIndex, setPlaybackRate]);

  useLayoutEffect(() => {
    layoutShelf();

    const onResize = () => scheduleShelfLayout();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [layoutShelf, scheduleShelfLayout]);

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const context = gsap.context(() => {
      const restoredLoadedIndex = removedIndexRef.current;
      if (phaseRef.current === "playing" && restoredLoadedIndex !== null) {
        const loadedSlot = slotRefs.current[restoredLoadedIndex];

        if (loadedSlot) {
          gsap.set(loadedSlot, { visibility: "hidden", autoAlpha: 0 });
        }

        gsap.set("[data-rack]", { autoAlpha: 0, scale: 1 });
        gsap.set("[data-turntable]", { autoAlpha: 1, scale: 1 });
        gsap.set([sleeveRef.current, floatingRecordRef.current], {
          autoAlpha: 0,
        });
        gsap.set(deckRecordRef.current, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
        gsap.set(tonearmRef.current, { rotationZ: tonearmAngleRef.current });
        layoutShelf();
        return;
      }

      const duration = reducedMotion ? 0.01 : 1;
      const visibleSlots = shelfItemRefs.current.filter(
        (slot): slot is HTMLButtonElement =>
          slot !== null && slot.style.visibility !== "hidden",
      );

      gsap.set("[data-turntable]", { autoAlpha: 0, scale: 0.96 });

      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          onComplete: layoutShelf,
        })
        .fromTo(
          "[data-rack]",
          { autoAlpha: 0, scale: 1.035 },
          { autoAlpha: 1, scale: 1, duration: duration * 0.95 },
          0,
        )
        .fromTo(
          visibleSlots,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: duration * 0.48,
            stagger: reducedMotion ? 0 : 0.012,
          },
          duration * 0.16,
        );
    }, rootRef);

    return () => context.revert();
  }, [layoutShelf, reducedMotion]);

  const restoreShelfAlbum = useCallback(
    (index: number) => {
      removedIndexRef.current = null;
      gapProgressRef.current.value = 0;

      const slot = slotRefs.current[index];
      if (slot) {
        gsap.set(slot, { visibility: "visible" });
      }

      layoutShelf();
    },
    [layoutShelf],
  );

  useLayoutEffect(() => {
    if (
      phase !== "extracting" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];
    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const size = sleeveBounds.width;
    const pose = getShowcasePose(size);
    const startX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const startY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const startScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(size, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.82;

    removedIndexRef.current = selectedIndex;
    gapProgressRef.current.value = 0;

    sequenceRef.current?.kill();
    gsap.set(sleeve, {
      x: startX,
      y: startY,
      scale: startScale,
      rotationX: shelfPose.rotationX,
      rotationY: shelfPose.rotationY,
      rotationZ: 0,
      autoAlpha: reducedMotion ? 0 : 1,
    });
    gsap.set(record, {
      x: startX,
      y: startY,
      scale: startScale * 0.96,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      transformPerspective: 900,
      transformOrigin: "50% 50%",
      autoAlpha: 0,
    });

    const sequence = gsap.timeline({
      onComplete: () => updatePhase("showcase"),
    });
    sequenceRef.current = sequence;

    if (selectedSlot) {
      sequence
        .to(
          selectedSlot,
          {
            z: "+=34",
            scale: "*=0.992",
            duration: reducedMotion ? 0.01 : 0.08,
            ease: "power2.out",
          },
          0,
        )
        .to(
          selectedSlot,
          {
            z: "+=58",
            autoAlpha: 0,
            duration: reducedMotion ? 0.08 : 0.14,
            ease: "power2.out",
          },
          reducedMotion ? 0 : 0.06,
        );
    }

    sequence.to(
      gapProgressRef.current,
      {
        value: 1,
        duration: reducedMotion ? 0.08 : duration * 0.54,
        ease: "power3.inOut",
        onUpdate: layoutShelf,
      },
      reducedMotion ? 0 : 0.16,
    );

    sequence
      .to(
        rackRef.current,
        {
          opacity: 0.38,
          y: reducedMotion ? 0 : 10,
          duration: duration * 0.58,
          ease: "power2.out",
        },
        0.08 * duration,
      )
      .to(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 1,
          rotationX: 0,
          rotationY: reducedMotion ? 0 : -1.4,
          rotationZ: reducedMotion ? 0 : -2.8,
          autoAlpha: 1,
          duration,
          ease: reducedMotion ? "power1.out" : "expo.out",
        },
        0.12 * duration,
      )
      .set(
        record,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.955,
          rotationX: reducedMotion ? 0 : 2,
          rotationY: 0,
          autoAlpha: 1,
        },
        0.46 * duration,
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          scale: 0.985,
          rotationX: 0,
          rotationZ: reducedMotion ? 0 : 2.4,
          duration: duration * 0.48,
          ease: reducedMotion ? "power1.out" : "expo.out",
        },
        0.54 * duration,
      );

    return () => {
      if (sequenceRef.current === sequence && sequence.isActive()) {
        sequence.kill();
      }
    };

  }, [layoutShelf, phase, reducedMotion, selectedIndex, updatePhase]);

  useEffect(() => {
    return () => {
      sequenceRef.current?.kill();
      mechanicsSequenceRef.current?.kill();
      shelfTweenRef.current?.kill();
      tonearmOperationRef.current += 1;
      if (shelfLayoutFrameRef.current !== null) {
        window.cancelAnimationFrame(shelfLayoutFrameRef.current);
      }
      if (wheelSnapRef.current !== null) {
        window.clearTimeout(wheelSnapRef.current);
      }
    };
  }, []);

  const handleRackPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      phaseRef.current !== "browsing" ||
      event.button !== 0 ||
      gestureRef.current.pointerId !== null
    ) {
      return;
    }

    shelfTweenRef.current?.kill();
    const pressedSlot = (event.target as Element).closest<HTMLElement>(
      "[data-record-index]",
    );
    const pressedIndex = Number(pressedSlot?.dataset.recordIndex);

    const now = performance.now();
    const axis = getShelfAxis();
    const referenceSize =
      slotRefs.current.find((slot) => Boolean(slot))?.offsetWidth;
    const coordinate = axis === "x" ? event.clientX : event.clientY;

    gestureRef.current = {
      pointerId: event.pointerId,
      axis,
      pitch: getShelfPitch(axis, referenceSize),
      startCoordinate: coordinate,
      lastCoordinate: coordinate,
      lastTime: now,
      velocity: 0,
      startPosition: positionRef.current.value,
      tapIndex: Number.isFinite(pressedIndex) ? pressedIndex : null,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRackPointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (
      phaseRef.current !== "browsing" ||
      gesture.pointerId !== event.pointerId
    ) {
      return;
    }

    const coordinate =
      gesture.axis === "x" ? event.clientX : event.clientY;
    const delta = coordinate - gesture.startCoordinate;
    const now = performance.now();
    const elapsed = Math.max(now - gesture.lastTime, 8);
    const sampledVelocity =
      ((coordinate - gesture.lastCoordinate) / elapsed) * 1000;

    gesture.velocity = gesture.velocity * 0.55 + sampledVelocity * 0.45;
    gesture.lastCoordinate = coordinate;
    gesture.lastTime = now;

    if (!gesture.moved && Math.abs(delta) > 8) {
      gesture.moved = true;
    }

    positionRef.current.value =
      gesture.startPosition - delta / gesture.pitch;
    const nextActive = wrapAlbumIndex(Math.round(positionRef.current.value));

    if (nextActive !== activeIndex) {
      setActiveIndex(nextActive);
    }
    scheduleShelfLayout();
  };

  const finishRackGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture.pointerId !== event.pointerId) {
      return;
    }

    const velocityIndex = -gesture.velocity / gesture.pitch;
    const projectedPosition =
      positionRef.current.value + clamp(velocityIndex * 0.18, -4, 4);
    const snapTarget = wrapAlbumIndex(
      Math.round(
        event.type === "pointercancel"
          ? positionRef.current.value
          : projectedPosition,
      ),
    );
    const tapTarget = gesture.tapIndex ?? activeIndex;
    gestureRef.current.pointerId = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.moved || event.type === "pointercancel") {
      setActiveIndex(snapTarget);
      animateShelfTo(snapTarget);
    } else {
      focusAlbum(tapTarget, true);
    }
  };

  const handleShelfWheel = (event: WheelEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    const axis = getShelfAxis();
    const rawDelta =
      axis === "x"
        ? Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.7
          ? event.deltaX
          : event.deltaY
        : event.deltaY;

    const delta =
      event.deltaMode === 1
        ? rawDelta * 16
        : event.deltaMode === 2
          ? rawDelta * (axis === "x" ? window.innerWidth : window.innerHeight)
          : rawDelta;

    if (Math.abs(delta) < 0.5) {
      return;
    }

    event.preventDefault();
    shelfTweenRef.current?.kill();
    const referenceSize =
      slotRefs.current.find((slot) => Boolean(slot))?.offsetWidth;
    const shelfPitch = getShelfPitch(axis, referenceSize);
    gestureRef.current.velocity = clamp(delta * -7, -1500, 1500);
    positionRef.current.value +=
      (clamp(delta, -120, 120) / shelfPitch) * 0.42;

    const nextActive = wrapAlbumIndex(Math.round(positionRef.current.value));
    if (nextActive !== activeIndex) {
      setActiveIndex(nextActive);
    }
    scheduleShelfLayout();

    if (wheelSnapRef.current !== null) {
      window.clearTimeout(wheelSnapRef.current);
    }
    wheelSnapRef.current = window.setTimeout(() => {
      wheelSnapRef.current = null;
      const target = wrapAlbumIndex(Math.round(positionRef.current.value));
      setActiveIndex(target);
      animateShelfTo(target);
    }, reducedMotion ? 0 : 90);
  };

  const handleRackKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex - 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex + 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focusedSlot = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-record-index]",
      );
      const focusedIndex = Number(focusedSlot?.dataset.recordIndex);
      focusAlbum(Number.isFinite(focusedIndex) ? focusedIndex : activeIndex, true);
    }
  };

  const isTonearmOnRecord = useCallback((angle: number) => {
    const geometry = tonearmGeometryRef.current;
    const sweepMinimum = Math.min(
      geometry.leadInAngle,
      geometry.runoutAngle,
    );
    const sweepMaximum = Math.max(
      geometry.leadInAngle,
      geometry.runoutAngle,
    );

    return angle >= sweepMinimum - 0.75 && angle <= sweepMaximum + 0.75;
  }, []);

  const setTonearmVisual = useCallback(
    (nextAngle: number, animate = false, commit = true) => {
      const geometry = tonearmGeometryRef.current;
      const angle = clamp(
        nextAngle,
        geometry.minimumAngle,
        geometry.maximumAngle,
      );

      tonearmAngleRef.current = angle;
      if (commit) {
        setTonearmAngle(angle);
      }

      if (!tonearmRef.current) {
        return;
      }

      if (animate) {
        const currentRotation =
          Number(gsap.getProperty(tonearmRef.current, "rotationZ")) || angle;
        const angularDistance = Math.abs(angle - currentRotation);
        gsap.to(tonearmRef.current, {
          rotationZ: angle,
          duration: reducedMotion
            ? 0.01
            : clamp(0.24 + angularDistance * 0.012, 0.3, 0.62),
          ease: "sine.inOut",
          overwrite: true,
        });
      } else {
        gsap.set(tonearmRef.current, { rotationZ: angle });
      }
    },
    [reducedMotion],
  );

  const setCueRaised = useCallback(
    (raised: boolean, stateOverride?: TonearmState | boolean) => {
      const nextState =
        typeof stateOverride === "string"
          ? stateOverride
          : raised
            ? isTonearmOnRecord(tonearmAngleRef.current)
              ? "raised"
              : "parked"
            : "tracking";

      tonearmRaisedRef.current = raised;
      setTonearmRaised(raised);
      setStylusContact(!raised && nextState === "tracking");
      setTonearmMechanicState(nextState);
    },
    [isTonearmOnRecord, setTonearmMechanicState],
  );

  const cancelTonearmOperation = useCallback(() => {
    tonearmOperationRef.current += 1;
    mechanicsSequenceRef.current?.kill();
    mechanicsSequenceRef.current = null;
  }, []);

  const animateTonearm = useCallback(
    (
      requestedAngle: number,
      options: {
        lower?: boolean;
        park?: boolean;
        stopMotorAfter?: boolean;
        onComplete?: () => void;
      } = {},
    ) => {
      const arm = tonearmRef.current;
      const geometry = tonearmGeometryRef.current;
      const targetAngle = clamp(
        requestedAngle,
        geometry.minimumAngle,
        geometry.maximumAngle,
      );
      const lowerRequested = options.lower ?? false;
      const park = options.park ?? false;
      const wasRaised = tonearmRaisedRef.current;
      const angularDistance = Math.abs(
        targetAngle - tonearmAngleRef.current,
      );
      const liftDuration = wasRaised
        ? 0
        : reducedMotion
          ? 0.01
          : TONEARM_LIFT_DURATION;
      const travelDuration =
        angularDistance < 0.08
          ? 0
          : reducedMotion
            ? 0.01
            : clamp(0.26 + angularDistance * 0.013, 0.32, 0.68);
      const lowerDuration = lowerRequested
        ? reducedMotion
          ? 0.01
          : TONEARM_LOWER_DURATION
        : 0;

      cancelTonearmOperation();
      const operationId = tonearmOperationRef.current;
      setStylusContact(false);

      if (!arm) {
        const shouldLower = lowerRequested && playIntentStateRef.current;
        tonearmAngleRef.current = targetAngle;
        setTonearmAngle(targetAngle);
        setCueRaised(
          !shouldLower,
          shouldLower ? "tracking" : park ? "parked" : "raised",
        );
        if (options.stopMotorAfter) {
          setMotorOn(false);
        }
        options.onComplete?.();
        return null;
      }

      if (!wasRaised) {
        setCueRaised(true, "lifting");
      } else if (travelDuration > 0) {
        setTonearmMechanicState(park ? "returning" : "traversing");
      }

      const sequence = gsap.timeline({
        onComplete: () => {
          if (tonearmOperationRef.current !== operationId) {
            return;
          }
          mechanicsSequenceRef.current = null;
          options.onComplete?.();
        },
      });
      mechanicsSequenceRef.current = sequence;

      if (travelDuration > 0) {
        sequence
          .call(
            () => {
              if (tonearmOperationRef.current === operationId) {
                setTonearmMechanicState(park ? "returning" : "traversing");
              }
            },
            undefined,
            liftDuration,
          )
          .to(
            arm,
            {
              rotationZ: targetAngle,
              duration: travelDuration,
              ease: "sine.inOut",
              overwrite: true,
            },
            liftDuration,
          );
      }

      const arrivalTime = liftDuration + travelDuration;
      sequence.call(
        () => {
          if (tonearmOperationRef.current !== operationId) {
            return;
          }
          tonearmAngleRef.current = targetAngle;
          setTonearmAngle(targetAngle);
          if (lowerRequested && playIntentStateRef.current) {
            setCueRaised(false, "lowering");
          } else {
            setCueRaised(true, park ? "parked" : "raised");
          }
        },
        undefined,
        arrivalTime,
      );

      if (lowerRequested) {
        sequence.call(
          () => {
            if (
              tonearmOperationRef.current === operationId &&
              playIntentStateRef.current
            ) {
              setCueRaised(false, "tracking");
            } else if (tonearmOperationRef.current === operationId) {
              setCueRaised(true, park ? "parked" : "raised");
            }
          },
          undefined,
          arrivalTime + lowerDuration,
        );
      }

      if (options.stopMotorAfter) {
        sequence.call(
          () => {
            if (tonearmOperationRef.current === operationId) {
              setMotorOn(false);
            }
          },
          undefined,
          arrivalTime + lowerDuration,
        );
      }

      return sequence;
    },
    [
      cancelTonearmOperation,
      reducedMotion,
      setCueRaised,
      setMotorOn,
      setTonearmMechanicState,
    ],
  );
  useEffect(() => {
    if (
      phase !== "playing" ||
      loadedIndex === null ||
      loadedIndex !== currentAlbumIndex ||
      duration <= 0 ||
      tonearmDragging
    ) {
      return;
    }

    const nextAngle = getTonearmAngleFromProgress(
      currentTime / duration,
      tonearmGeometryRef.current,
    );

    if (tonearmStateRef.current === "tracking") {
      // The RAF is the sole DOM writer while tracking; React state is updated
      // here only for accessible value text and status copy.
      tonearmAngleRef.current = nextAngle;
      setTonearmAngle(nextAngle);
    } else if (
      tonearmStateRef.current === "raised" &&
      isTonearmOnRecord(tonearmAngleRef.current)
    ) {
      setTonearmVisual(nextAngle, false);
    }
  }, [
    currentAlbumIndex,
    currentTime,
    duration,
    isTonearmOnRecord,
    loadedIndex,
    phase,
    setTonearmVisual,
    tonearmDragging,
  ]);
  useEffect(() => {
    if (
      phaseRef.current !== "playing" ||
      loadedIndex === null ||
      loadedIndex === currentAlbumIndex
    ) {
      return;
    }

    const nextIndex = wrapAlbumIndex(currentAlbumIndex);
    const previousSlot = slotRefs.current[loadedIndex];
    const nextSlot = slotRefs.current[nextIndex];

    if (previousSlot) {
      gsap.set(previousSlot, { visibility: "visible", autoAlpha: 1 });
    }

    positionRef.current.value = getNearestVirtualPosition(
      nextIndex,
      positionRef.current.value,
    );
    removedIndexRef.current = nextIndex;
    gapProgressRef.current.value = 1;

    if (nextSlot) {
      gsap.set(nextSlot, { visibility: "hidden", autoAlpha: 0 });
    }

    const syncedAngle = getTonearmAngleFromProgress(
      duration > 0 ? currentTime / duration : 0,
      tonearmGeometryRef.current,
    );
    setActiveIndex(nextIndex);
    setSelectedIndex(nextIndex);
    setLoadedIndex(nextIndex);
    setSpeed(vinylAlbums[nextIndex].vinyl.rpm === 45 ? 45 : 33);
    setMotorOn(playIntentStateRef.current);
    animateTonearm(syncedAngle, { lower: true });
    layoutShelf();
  }, [
    animateTonearm,
    currentAlbumIndex,
    currentTime,
    duration,
    layoutShelf,
    loadedIndex,
    setMotorOn,
  ]);

  useEffect(() => {
    if (
      phaseRef.current !== "playing" ||
      loadedIndex === null ||
      loadedIndex !== currentAlbumIndex
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (error) {
        return;
      }

      if (playIntent && playbackState !== "ended") {
        setMotorOn(true);
        if (
          tonearmStateRef.current !== "tracking" &&
          tonearmStateRef.current !== "lowering" &&
          tonearmStateRef.current !== "traversing"
        ) {
          const targetAngle = getTonearmAngleFromProgress(
            duration > 0 ? currentTime / duration : 0,
            tonearmGeometryRef.current,
          );
          animateTonearm(targetAngle, { lower: true });
        }
        return;
      }

      if (
        !playIntent &&
        playbackState !== "ended" &&
        (tonearmStateRef.current === "tracking" ||
          tonearmStateRef.current === "lowering")
      ) {
        animateTonearm(tonearmAngleRef.current, {
          stopMotorAfter: true,
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    animateTonearm,
    currentAlbumIndex,
    currentTime,
    duration,
    error,
    loadedIndex,
    playbackState,
    playIntent,
    setMotorOn,
  ]);

  const togglePlayback = useCallback(() => {
    if (!isTransportPhase(phaseRef.current) || loadedIndex === null) {
      return;
    }

    if (playIntentStateRef.current) {
      requestPause();
    } else {
      requestPlay();
    }
  }, [loadedIndex, requestPause, requestPlay]);

  const toggleMotor = useCallback(() => {
    if (phaseRef.current !== "playing" || loadedIndex === null) {
      return;
    }

    if (!motorOnRef.current) {
      setMotorOn(true);
      return;
    }

    if (playIntentStateRef.current) {
      requestPause();
      return;
    }

    if (
      tonearmStateRef.current === "tracking" ||
      tonearmStateRef.current === "lowering"
    ) {
      animateTonearm(tonearmAngleRef.current, {
        stopMotorAfter: true,
      });
      return;
    }

    setMotorOn(false);
  }, [animateTonearm, loadedIndex, requestPause, setMotorOn]);

  const toggleSpeed = useCallback(() => {
    if (phaseRef.current !== "playing") {
      return;
    }

    setSpeed((currentSpeed) => (currentSpeed === 33 ? 45 : 33));
  }, []);

  const setDeckSpeed = useCallback((nextSpeed: PlaybackSpeed) => {
    if (phaseRef.current !== "playing") {
      return;
    }

    setSpeed(nextSpeed);
  }, []);

  const toggleCue = useCallback(() => {
    if (phaseRef.current !== "playing" || loadedIndex === null) {
      return;
    }

    if (!tonearmRaisedRef.current) {
      requestPause();
      animateTonearm(tonearmAngleRef.current);
      return;
    }

    const targetAngle = isTonearmOnRecord(tonearmAngleRef.current)
      ? tonearmAngleRef.current
      : getTonearmAngleFromProgress(
          duration > 0 ? currentTime / duration : 0,
          tonearmGeometryRef.current,
        );

    setMotorOn(true);
    requestPlay();
    animateTonearm(targetAngle, { lower: true });
  }, [
    animateTonearm,
    currentTime,
    duration,
    isTonearmOnRecord,
    loadedIndex,
    requestPause,
    requestPlay,
    setMotorOn,
  ]);

  const getTonearmAngleFromPointer = useCallback(
    (clientX: number, clientY: number, grabOffset = 0) => {
      const base = tonearmBaseRef.current?.getBoundingClientRect();

      if (!base) {
        return tonearmAngleRef.current;
      }

      const pivotX = base.left + base.width / 2;
      const pivotY = base.top + base.height / 2;
      const pointerYaw = normalizeTonearmAngle(
        (Math.atan2(clientY - pivotY, clientX - pivotX) * 180) / Math.PI -
          180,
      );
      const geometry = tonearmGeometryRef.current;

      return clamp(
        pointerYaw + grabOffset,
        geometry.minimumAngle,
        geometry.maximumAngle,
      );
    },
    [],
  );

  const handleTonearmPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (
        phaseRef.current !== "playing" ||
        loadedIndex === null ||
        event.button !== 0 ||
        tonearmGestureRef.current.pointerId !== null
      ) {
        return;
      }

      event.preventDefault();
      const pointerYaw = getTonearmAngleFromPointer(
        event.clientX,
        event.clientY,
      );
      tonearmGestureRef.current = {
        pointerId: event.pointerId,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        grabOffset: tonearmAngleRef.current - pointerYaw,
        resumeOnDrop: playIntentStateRef.current,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setTonearmDragging(true);
    },
    [getTonearmAngleFromPointer, loadedIndex],
  );

  const handleTonearmPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (
        phaseRef.current !== "playing" ||
        gesture.pointerId !== event.pointerId
      ) {
        return;
      }

      const travel = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY,
      );

      if (!gesture.moved && travel > 4) {
        gesture.moved = true;
        cancelTonearmOperation();
        if (gesture.resumeOnDrop) {
          requestPause();
        }
        setCueRaised(true, "lifting");
      }

      if (gesture.moved) {
        setTonearmMechanicState("traversing");
        setTonearmVisual(
          getTonearmAngleFromPointer(
            event.clientX,
            event.clientY,
            gesture.grabOffset,
          ),
          false,
          false,
        );
      }
    },
    [
      cancelTonearmOperation,
      getTonearmAngleFromPointer,
      requestPause,
      setCueRaised,
      setTonearmMechanicState,
      setTonearmVisual,
    ],
  );

  const finishTonearmGesture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (gesture.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const moved = gesture.moved;
      const resumeOnDrop = gesture.resumeOnDrop;
      tonearmGestureRef.current.pointerId = null;
      setTonearmDragging(false);

      if (!moved) {
        toggleCue();
        return;
      }

      if (!isTonearmOnRecord(tonearmAngleRef.current)) {
        seek(0);
        animateTonearm(tonearmGeometryRef.current.homeAngle, {
          park: true,
          stopMotorAfter: resumeOnDrop,
        });
        return;
      }

      if (duration > 0) {
        seek(
          duration *
            getProgressFromTonearmAngle(
              tonearmAngleRef.current,
              tonearmGeometryRef.current,
            ),
        );
      }

      if (event.type !== "pointercancel" && resumeOnDrop) {
        setMotorOn(true);
        requestPlay();
        animateTonearm(tonearmAngleRef.current, { lower: true });
      } else {
        setCueRaised(true, "raised");
      }
    },
    [
      animateTonearm,
      duration,
      isTonearmOnRecord,
      requestPlay,
      seek,
      setCueRaised,
      setMotorOn,
      toggleCue,
    ],
  );

  const handleTonearmKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCue();
        return;
      }

      const geometry = tonearmGeometryRef.current;
      let nextAngle: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextAngle = tonearmAngleRef.current + 1.5;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextAngle = tonearmAngleRef.current - 1.5;
      } else if (event.key === "Home") {
        nextAngle = geometry.homeAngle;
      } else if (event.key === "End") {
        nextAngle = geometry.runoutAngle;
      }

      if (nextAngle === null) {
        return;
      }

      event.preventDefault();
      if (playIntentStateRef.current) {
        requestPause();
      }

      const keyboardAngle = clamp(
        nextAngle,
        geometry.minimumAngle,
        geometry.maximumAngle,
      );

      if (!isTonearmOnRecord(keyboardAngle)) {
        seek(0);
        animateTonearm(geometry.homeAngle, { park: true });
        return;
      }

      if (duration > 0) {
        seek(
          duration * getProgressFromTonearmAngle(keyboardAngle, geometry),
        );
      }
      animateTonearm(keyboardAngle);
    },
    [
      animateTonearm,
      duration,
      isTonearmOnRecord,
      requestPause,
      seek,
      toggleCue,
    ],
  );

  const settleLoadingTransport = useCallback(() => {
    if (phaseRef.current !== "loading") {
      return;
    }

    sequenceRef.current?.kill();
    sequenceRef.current = null;
    const turntable = rootRef.current?.querySelector<HTMLElement>(
      "[data-turntable]",
    );
    if (rackRef.current) {
      gsap.set(rackRef.current, { autoAlpha: 0, scale: 1, y: 0 });
    }
    if (turntable) {
      gsap.set(turntable, { autoAlpha: 1, scale: 1 });
    }
    if (sleeveRef.current) {
      gsap.set(sleeveRef.current, { autoAlpha: 0 });
    }
    if (floatingRecordRef.current) {
      gsap.set(floatingRecordRef.current, { autoAlpha: 0 });
    }
    if (deckRecordRef.current) {
      gsap.set(deckRecordRef.current, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
      });
    }
    updatePhase("playing");
  }, [updatePhase]);

  const seekPlayback = useCallback(
    (requestedSeconds: number) => {
      if (
        !isTransportPhase(phaseRef.current) ||
        loadedIndex === null
      ) {
        return;
      }

      settleLoadingTransport();

      const targetSeconds = clamp(requestedSeconds, 0, duration);
      const targetAngle = getTonearmAngleFromProgress(
        duration > 0 ? targetSeconds / duration : 0,
        tonearmGeometryRef.current,
      );
      const reachesEnd = duration > 0 && targetSeconds >= duration - 0.05;

      // Seek is immediate and preserves the current play/pause intent. The
      // physical arm follows as a visual consequence, never as a gate.
      seek(targetSeconds);

      if (reachesEnd) {
        animateTonearm(tonearmGeometryRef.current.runoutAngle);
        return;
      }

      if (playIntentStateRef.current) {
        setMotorOn(true);
        animateTonearm(targetAngle, { lower: true });
      } else {
        animateTonearm(targetAngle);
      }
    },
    [
      animateTonearm,
      duration,
      loadedIndex,
      seek,
      setMotorOn,
      settleLoadingTransport,
    ],
  );

  const placeRecord = useCallback(() => {
    const turntable = rootRef.current?.querySelector<HTMLElement>(
      "[data-turntable]",
    );

    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !rackRef.current ||
      !turntable
    ) {
      return;
    }

    updatePhase("loading");
    cancelTonearmOperation();
    setCueRaised(true, "parked");
    setMotorOn(false);
    resetPlaybackOrder(selectedIndex);
    playIntentStateRef.current = true;
    selectAndPlay(selectedIndex);
    setLoadedIndex(selectedIndex);
    setSpeed(vinylAlbums[selectedIndex].vinyl.rpm === 45 ? 45 : 33);
    const geometry = tonearmGeometryRef.current;
    tonearmAngleRef.current = geometry.homeAngle;
    setTonearmAngle(geometry.homeAngle);

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    // The hidden scene used to be scaled to .96, which made every landing
    // several pixels short. Freeze its final geometry before measuring it.
    gsap.set(turntable, { scale: 1 });
    const deckRecordBounds = deckRecord.getBoundingClientRect();
    const recordBounds = record.getBoundingClientRect();
    const currentScale = Number(gsap.getProperty(record, "scale")) || 1;
    const currentX = Number(gsap.getProperty(record, "x")) || 0;
    const currentY = Number(gsap.getProperty(record, "y")) || 0;
    const deltaX =
      deckRecordBounds.left +
      deckRecordBounds.width / 2 -
      (recordBounds.left + recordBounds.width / 2);
    const deltaY =
      deckRecordBounds.top +
      deckRecordBounds.height / 2 -
      (recordBounds.top + recordBounds.height / 2);
    // The showcased disc is slightly tilted, so its screen-space bounding box
    // is wider than its real CSS diameter. Scaling from that distorted box
    // made the hidden deck disc appear a few pixels larger at the DOM handoff.
    // Use the untransformed diameter so both records meet at exactly one size.
    const landingScale =
      deckRecordBounds.width / Math.max(record.offsetWidth, 1);
    const targetX = currentX + deltaX;
    const targetY = currentY + deltaY;

    sequenceRef.current?.kill();
    setVinylPresentationVariant(record, "floating");
    gsap.set(deckRecord, { autoAlpha: 0, x: 0, y: 0, scale: 1 });
    gsap.set(record, {
      transformPerspective: 1100,
      transformOrigin: "50% 50%",
      zIndex: 8,
      willChange: "transform, opacity",
    });

    if (reducedMotion) {
      const reducedSequence = gsap.timeline({
        onComplete: () => {
          tonearmAngleRef.current = geometry.leadInAngle;
          setTonearmAngle(geometry.leadInAngle);
          updatePhase("playing");
          if (playIntentStateRef.current) {
            setMotorOn(true);
            setCueRaised(false, "tracking");
          } else {
            setMotorOn(false);
            setCueRaised(true, "raised");
          }
        },
      });
      sequenceRef.current = reducedSequence;
      reducedSequence
        .to(rackRef.current, { autoAlpha: 0, duration: 0.14, ease: "none" }, 0)
        .to(turntable, { autoAlpha: 1, duration: 0.16, ease: "none" }, 0)
        .set([sleeve, record], { autoAlpha: 0 }, 0.12)
        .set(deckRecord, { autoAlpha: 1 }, 0.12)
        .set(tonearmRef.current, { rotationZ: geometry.leadInAngle }, 0.12);
      return;
    }

    const flight = { progress: 0 };
    const flightStartX = currentX + 48;
    const flightStartY = currentY - 28;
    const flightEndY = targetY - 26;
    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = geometry.leadInAngle;
        setTonearmAngle(geometry.leadInAngle);
      },
    });
    sequenceRef.current = sequence;
    sequence
      .addLabel("clear", 0)
      .addLabel("carry", 0.24)
      .addLabel("seat", 1.08)
      .addLabel("handoff", 1.29)
      .addLabel("motor", 1.34)
      .addLabel("arm", 1.46)
      .addLabel("needle", 2.12)
      .to(
        rackRef.current,
        {
          autoAlpha: 0,
          scale: 1.018,
          duration: 0.36,
          ease: "power2.in",
        },
        "clear",
      )
      .fromTo(
        turntable,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.42,
          ease: "power3.out",
        },
        0.1,
      )
      .to(
        sleeve,
        {
          x: "-=24",
          y: "+=30",
          scale: 0.88,
          rotationX: 4,
          rotationY: -10,
          rotationZ: -7,
          autoAlpha: 0,
          duration: 0.48,
          ease: "power3.in",
        },
        "clear+=0.04",
      )
      .to(
        record,
        {
          x: flightStartX,
          y: flightStartY,
          scale: currentScale * 1.02,
          rotationX: -6,
          rotationY: 0,
          rotationZ: -2,
          duration: 0.24,
          ease: "power3.out",
        },
        "clear",
      )
      .to(
        flight,
        {
          progress: 1,
          duration: 0.84,
          ease: "sine.inOut",
          onUpdate: () => {
            const progress = flight.progress;
            const lift = Math.sin(Math.PI * progress);
            const x = getCubicBezierValue(
              flightStartX,
              currentX + deltaX * 0.34,
              targetX - deltaX * 0.12,
              targetX,
              progress,
            );
            const y = getCubicBezierValue(
              flightStartY,
              flightStartY - 92,
              flightEndY - 54,
              flightEndY,
              progress,
            );
            const scale =
              currentScale * 1.02 +
              (landingScale * 1.008 - currentScale * 1.02) * progress +
              lift * 0.018;

            gsap.set(record, {
              x,
              y,
              scale,
              rotationX: -6 + 3 * progress - lift * 2,
              rotationY: lift * 1.2,
              rotationZ: -2 + 3 * progress + lift * 1.5,
            });
          },
        },
        "carry",
      )
      .to(
        record,
        {
          y: targetY,
          scale: landingScale,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          duration: 0.21,
          ease: "sine.out",
        },
        "seat",
      )
      .call(
        () => setVinylPresentationVariant(record, "platter"),
        undefined,
        "handoff-=0.02",
      )
      .set(record, { autoAlpha: 0 }, "handoff")
      .set(deckRecord, { autoAlpha: 1 }, "handoff")
      .call(
        () => {
          if (playIntentStateRef.current) {
            setMotorOn(true);
          }
        },
        undefined,
        "motor",
      )
      .to(
        tonearmRef.current,
        {
          rotationZ: geometry.leadInAngle,
          duration: 0.52,
          ease: "sine.inOut",
        },
        "arm",
      )
      .call(
        () => {
          tonearmAngleRef.current = geometry.leadInAngle;
          setTonearmAngle(geometry.leadInAngle);
          updatePhase("playing");
          if (playIntentStateRef.current) {
            setCueRaised(false, "tracking");
          } else {
            setCueRaised(true, "raised");
            setMotorOn(false);
          }
        },
        undefined,
        "needle",
      )
      .set(record, { willChange: "auto" }, "needle+=0.5");
  }, [
    cancelTonearmOperation,
    reducedMotion,
    resetPlaybackOrder,
    selectedIndex,
    selectAndPlay,
    setCueRaised,
    setMotorOn,
    updatePhase,
  ]);

  const closeSleeve = useCallback(() => {
    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    updatePhase("closing");

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const targetX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const targetY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const targetScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(sleeveBounds.width, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.72;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;
    sequence
      .to(record, {
        x: gsap.getProperty(sleeve, "x") as number,
        duration: duration * 0.42,
        ease: "power2.inOut",
      })
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: reducedMotion ? 0.08 : duration * 0.54,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        `>-${duration * 0.12}`,
      )
      .to(
        rackRef.current,
          {
            opacity: 0.58,
            duration: reducedMotion ? 0.08 : duration * 0.4,
          ease: "power2.out",
        },
        "<",
      )
      .to(
        [sleeve, record],
        {
          x: targetX,
          y: targetY,
          scale: targetScale,
          rotationX: shelfPose.rotationX,
          rotationY: shelfPose.rotationY,
          rotationZ: 0,
          duration,
          ease: "power3.inOut",
        },
        ">",
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.01 : 0.1,
        },
        ">-0.1",
      )
      .to(
        rackRef.current,
          {
            opacity: 1,
            y: 0,
            duration: duration * 0.58,
          ease: "power2.out",
        },
        `>-${duration * 0.34}`,
      );
  }, [
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    updatePhase,
  ]);

  const returnRecord = useCallback(() => {
    const turntable = rootRef.current?.querySelector<HTMLElement>(
      "[data-turntable]",
    );

    if (
      phaseRef.current !== "playing" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !rackRef.current ||
      !turntable
    ) {
      return;
    }

    updatePhase("returning");
    cancelTonearmOperation();
    setCueRaised(true, "returning");
    clearPlayback();
    const geometry = tonearmGeometryRef.current;

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    // The sleeve is scaled down and hidden while playing. Use the record's
    // untransformed box so the handoff preserves the on-platter diameter.
    const sleeveSize = record.offsetWidth || sleeve.offsetWidth || 1;
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const deckRecordBounds = deckRecord.getBoundingClientRect();
    const pose = getShowcasePose(sleeveSize);
    const platterX =
      deckRecordBounds.left +
      deckRecordBounds.width / 2 -
      window.innerWidth / 2;
    const platterY =
      deckRecordBounds.top +
      deckRecordBounds.height / 2 -
      window.innerHeight / 2;
    const platterScale = deckRecordBounds.width / Math.max(sleeveSize, 1);
    const shelfX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const shelfY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const shelfScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(sleeveSize, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const motionBeat = reducedMotion ? 0.25 : 1;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = geometry.homeAngle;
        setTonearmAngle(geometry.homeAngle);
        setTonearmMechanicState("parked");
        setMotorOn(false);
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        setLoadedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;

    sequence
      .addLabel("lift", 0)
      .addLabel("park", 0.3 * motionBeat)
      .addLabel("brake", 0.94 * motionBeat)
      .addLabel("handoff", 1.7 * motionBeat)
      .addLabel("carry", 2 * motionBeat)
      .addLabel("sleeve", 2.34 * motionBeat)
      .addLabel("shelf", 2.9 * motionBeat)
      .to(
        tonearmRef.current,
        {
          rotationZ: geometry.homeAngle,
          duration: 0.56 * motionBeat,
          ease: "sine.inOut",
        },
        "park",
      )
      .call(() => setMotorOn(false), undefined, "brake")
      .set(
        record,
        {
          x: platterX,
          y: platterY,
          scale: platterScale,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          autoAlpha: 0,
          willChange: "transform, opacity",
        },
        "handoff",
      )
      .call(
        () => setVinylPresentationVariant(record, "platter"),
        undefined,
        "handoff",
      )
      .set(deckRecord, { autoAlpha: 0 }, "handoff")
      .set(record, { autoAlpha: 1 }, "handoff")
      .to(
        record,
        {
          y: platterY - (reducedMotion ? 0 : 26),
          scale: platterScale * (reducedMotion ? 1 : 1.015),
          rotationX: reducedMotion ? 0 : -7,
          duration: 0.2 * motionBeat,
          ease: "power2.out",
        },
        `handoff+=${0.02 * motionBeat}`,
      )
      .call(
        () => setVinylPresentationVariant(record, "floating"),
        undefined,
        `handoff+=${0.12 * motionBeat}`,
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          y: pose.y - (reducedMotion ? 0 : 28),
          scale: 0.975,
          rotationX: reducedMotion ? 0 : -2,
          rotationZ: reducedMotion ? 0 : -2,
          duration: 0.54 * motionBeat,
          ease: reducedMotion ? "power1.out" : "power3.inOut",
        },
        "carry",
      )
      .to(
        record,
        {
          y: pose.y,
          rotationX: 0,
          duration: 0.14 * motionBeat,
          ease: "power2.out",
        },
        `carry+=${0.54 * motionBeat}`,
      )
      .set(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.88,
          rotationX: 0,
          rotationY: 0,
          rotationZ: reducedMotion ? 0 : -4.6,
          autoAlpha: 0,
        },
        `sleeve-=${0.12 * motionBeat}`,
      )
      .set(record, { zIndex: 2 }, `sleeve+=${0.18 * motionBeat}`)
      .to(
        sleeve,
        {
          autoAlpha: 1,
          scale: 1,
          rotationZ: reducedMotion ? 0 : -4.6,
          duration: 0.26 * motionBeat,
          ease: "power2.out",
        },
        `sleeve-=${0.12 * motionBeat}`,
      )
      .to(
        record,
        {
          x: pose.x,
          duration: 0.28 * motionBeat,
          ease: "power2.inOut",
        },
        `sleeve+=${0.24 * motionBeat}`,
      )
      .to(
        turntable,
        {
          autoAlpha: 0,
          scale: reducedMotion ? 1 : 0.975,
          duration: 0.38 * motionBeat,
          ease: "power2.in",
        },
        2.15 * motionBeat,
      )
      .to(
        rackRef.current,
          {
            autoAlpha: 0.58,
            scale: reducedMotion ? 1 : 1.018,
            duration: 0.3 * motionBeat,
          ease: "power2.out",
        },
        2.62 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          x: shelfX,
          y: shelfY - (reducedMotion ? 0 : 22),
          scale: shelfScale,
          rotationX: shelfPose.rotationX,
          rotationY: shelfPose.rotationY,
          rotationZ: 0,
          duration: 0.48 * motionBeat,
          ease: "power3.inOut",
        },
        "shelf",
      )
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: 0.32 * motionBeat,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        3.14 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          y: shelfY,
          duration: 0.12 * motionBeat,
          ease: "power2.in",
        },
        3.38 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: 0.08 * motionBeat,
        },
        3.5 * motionBeat,
      )
      .to(
        rackRef.current,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.35 * motionBeat,
          ease: "power2.out",
        },
        2.96 * motionBeat,
      )
      .set(record, { willChange: "auto" }, 3.58 * motionBeat);
  }, [
    cancelTonearmOperation,
    clearPlayback,
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    setCueRaised,
    setMotorOn,
    setTonearmMechanicState,
    updatePhase,
  ]);

  const selectPlayingAlbum = useCallback(
    (
      requestedIndex: number,
      resumeOverride?: boolean,
      recordHistory = true,
    ) => {
      if (
        !isTransportPhase(phaseRef.current) ||
        loadedIndex === null ||
        !deckRecordRef.current ||
        !tonearmRef.current
      ) {
        return;
      }

      const nextIndex = wrapAlbumIndex(requestedIndex);
      if (nextIndex === loadedIndex) {
        return;
      }

      const deckRecord = deckRecordRef.current;
      const resumeAfterSwitch =
        resumeOverride ?? playIntentStateRef.current;
      const previousSlot = slotRefs.current[loadedIndex];
      const nextSlot = slotRefs.current[nextIndex];

      if (recordHistory) {
        recordPlaybackSelection(nextIndex);
      }

      playIntentStateRef.current = resumeAfterSwitch;
      if (resumeAfterSwitch) {
        selectAndPlay(nextIndex);
      } else {
        cueAlbum(nextIndex);
      }

      // A digital track change owns the media immediately. Collapse any
      // unfinished record-placement scene, then let a short, cancelable visual
      // handoff and the independent tonearm state machine follow the new source.
      sequenceRef.current?.kill();
      sequenceRef.current = null;
      settleLoadingTransport();

      if (previousSlot) {
        gsap.set(previousSlot, { visibility: "visible", autoAlpha: 1 });
      }
      positionRef.current.value = getNearestVirtualPosition(
        nextIndex,
        positionRef.current.value,
      );
      removedIndexRef.current = nextIndex;
      gapProgressRef.current.value = 1;
      if (nextSlot) {
        gsap.set(nextSlot, { visibility: "hidden", autoAlpha: 0 });
      }

      setActiveIndex(nextIndex);
      setSelectedIndex(nextIndex);
      setLoadedIndex(nextIndex);
      setSpeed(vinylAlbums[nextIndex].vinyl.rpm === 45 ? 45 : 33);
      layoutShelf();

      updatePhase("switching");
      cancelTonearmOperation();
      setMotorOn(resumeAfterSwitch);
      animateTonearm(tonearmGeometryRef.current.leadInAngle, {
        // Reserve the lowering beat even for a paused selection so a resume
        // during the visual handoff can complete naturally. The tonearm
        // renderer checks the live play intent before making contact.
        lower: true,
      });

      const sequence = gsap.timeline({
        onComplete: () => {
          if (sequenceRef.current !== sequence) {
            return;
          }
          sequenceRef.current = null;
          updatePhase("playing");
          if (!playIntentStateRef.current) {
            setMotorOn(false);
          }
        },
      });
      sequenceRef.current = sequence;
      sequence.fromTo(
        deckRecord,
        {
          autoAlpha: reducedMotion ? 1 : 0.58,
          y: reducedMotion ? 0 : -10,
          scale: reducedMotion ? 1 : 0.992,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: reducedMotion ? 0.01 : 0.24,
          ease: "power2.out",
          overwrite: true,
        },
      );
    },
    [
      animateTonearm,
      cancelTonearmOperation,
      cueAlbum,
      layoutShelf,
      loadedIndex,
      recordPlaybackSelection,
      reducedMotion,
      selectAndPlay,
      setMotorOn,
      settleLoadingTransport,
      updatePhase,
    ],
  );

  const playPreviousAlbum = useCallback(() => {
    if (loadedIndex === null) {
      return;
    }

    if (currentTime > 3) {
      seekPlayback(0);
      return;
    }

    const previousIndex = takePreviousAlbumIndex();
    if (previousIndex === null) {
      seekPlayback(0);
      return;
    }

    selectPlayingAlbum(previousIndex, undefined, !shuffleEnabled);
  }, [
    currentTime,
    loadedIndex,
    seekPlayback,
    selectPlayingAlbum,
    shuffleEnabled,
    takePreviousAlbumIndex,
  ]);

  const playNextAlbum = useCallback(
    (shuffle = false, resumeOverride?: boolean) => {
      if (loadedIndex === null) {
        return false;
      }

      const nextIndex = getNextAlbumIndex(shuffle);

      if (nextIndex === null) {
        return false;
      }

      selectPlayingAlbum(nextIndex, resumeOverride);
      return true;
    },
    [getNextAlbumIndex, loadedIndex, selectPlayingAlbum],
  );

  const replayCurrentAlbum = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      loadedIndex === null ||
      !tonearmRef.current
    ) {
      return;
    }

    setMotorOn(true);
    animateTonearm(tonearmGeometryRef.current.leadInAngle, {
      lower: true,
    });
  }, [animateTonearm, loadedIndex, setMotorOn]);

  const finishPlaybackAtEnd = useCallback(() => {
    if (
      phaseRef.current !== "playing" ||
      loadedIndex === null ||
      !tonearmRef.current
    ) {
      return;
    }

    animateTonearm(tonearmGeometryRef.current.homeAngle, {
      park: true,
      stopMotorAfter: true,
    });
  }, [animateTonearm, loadedIndex]);

  const handlePlaybackEnded = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!playIntentStateRef.current) {
        finishPlaybackAtEnd();
      } else if (repeatMode === "one") {
        replayCurrentAlbum();
      }
      // Provider owns repeat/shuffle/next. A changed currentAlbumIndex is
      // observed by the visual sync effect above, so this callback never
      // performs a second navigation.
    });
  }, [
    finishPlaybackAtEnd,
    repeatMode,
    replayCurrentAlbum,
  ]);

  useEffect(() => {
    transportActionsRef.current = {
      play: () => {
        if (!transportActive) {
          togglePlayback();
        }
      },
      pause: () => {
        if (transportActive) {
          togglePlayback();
        }
      },
      previous: playPreviousAlbum,
      next: playNextAlbum,
      seek: seekPlayback,
      ended: handlePlaybackEnded,
    };
  }, [
    handlePlaybackEnded,
    playNextAlbum,
    playPreviousAlbum,
    seekPlayback,
    togglePlayback,
    transportActive,
  ]);

  useEffect(
    () =>
      registerTransportController({
        play: () => transportActionsRef.current.play(),
        pause: () => transportActionsRef.current.pause(),
        previous: () => transportActionsRef.current.previous(),
        next: (shuffle) => transportActionsRef.current.next(shuffle),
        seek: (seconds) => transportActionsRef.current.seek(seconds),
        ended: () => transportActionsRef.current.ended(),
      }),
    [registerTransportController],
  );

  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (
        rootRef.current?.querySelector(
          '[data-queue-open="true"], [data-device-open="true"]',
        )
      ) {
        return;
      }

      if (phaseRef.current === "showcase") {
        closeSleeve();
      } else if (phaseRef.current === "playing") {
        returnRecord();
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [closeSleeve, returnRecord]);

  const statusText = (() => {
    if (!selectedAlbum) {
      return `${vinylAlbums[activeIndex].title} is focused in the three-dimensional album shelf.`;
    }

    if (phase === "playing") {
      if (error) {
        return `${selectedTrack.title} could not start. ${error}`;
      }

      if (isPriming) {
        return `${selectedTrack.title} by ${selectedTrack.artist} is being prepared.`;
      }

      if (transportStarting) {
        return `${selectedTrack.title} by ${selectedTrack.artist} is starting as the platter and cue settle.`;
      }

      if (playbackState === "buffering") {
        return `${selectedTrack.title} by ${selectedTrack.artist} is buffering while the platter remains at speed.`;
      }

      if (playbackState === "loading") {
        return `${selectedTrack.title} by ${selectedTrack.artist} is starting.`;
      }

      if (playbackState === "ended") {
        return `${selectedTrack.title} by ${selectedTrack.artist} has finished.`;
      }

      return isPlaying
        ? `${selectedTrack.title} by ${selectedTrack.artist} is playing, paired with the ${selectedAlbum.title} sleeve.`
        : `${selectedTrack.title} by ${selectedTrack.artist} is paused, paired with the ${selectedAlbum.title} sleeve.`;
    }

    if (phase === "showcase") {
      return `${selectedAlbum.title} is out of the rack. Playing this sleeve starts ${selectedTrack.title} by ${selectedTrack.artist}.`;
    }

    return `${selectedAlbum.title} is being handled with ${selectedTrack.title} by ${selectedTrack.artist}.`;
  })();

  return (
    <main
      ref={rootRef}
      className={styles.page}
      data-phase={phase}
    >
      <div className={styles.roomGrain} aria-hidden="true" />

      <div className={styles.turntableStage} data-turntable>
        <Turntable
          phase={phase}
          album={loadedAlbum}
          onEject={returnRecord}
          onPrevious={playPreviousAlbum}
          onNext={playNextAlbum}
          onSelectAlbum={selectPlayingAlbum}
          motorOn={motorOn}
          motorState={motorState}
          speed={speed}
          tonearmAngle={tonearmAngle}
          tonearmGeometry={tonearmGeometry}
          tonearmState={tonearmState}
          tonearmRaised={tonearmRaised}
          stylusContact={stylusContact}
          tonearmDragging={tonearmDragging}
          elapsedSeconds={currentTime}
          duration={duration}
          volume={volume}
          isPlaying={isPlaying}
          isPriming={isPriming}
          isStarting={transportStarting}
          playIntent={playIntent}
          playbackState={playbackState}
          shuffleEnabled={shuffleEnabled}
          repeatMode={repeatMode}
          queueIndices={queueIndices}
          error={error}
          track={loadedTrack}
          onSeek={seekPlayback}
          onVolumeChange={setVolume}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
          onTogglePlayback={togglePlayback}
          onToggleMotor={toggleMotor}
          onToggleSpeed={toggleSpeed}
          onSetSpeed={setDeckSpeed}
          onToggleCue={toggleCue}
          onTonearmPointerDown={handleTonearmPointerDown}
          onTonearmPointerMove={handleTonearmPointerMove}
          onTonearmPointerUp={finishTonearmGesture}
          onTonearmKeyDown={handleTonearmKeyDown}
          platterRef={platterRef}
          platterStrobeRef={platterStrobeRef}
          deckRecordRef={deckRecordRef}
          deckRotorRef={deckRotorRef}
          tonearmBaseRef={tonearmBaseRef}
          tonearmRef={tonearmRef}
          stylusRef={stylusRef}
        />
      </div>

      <section
        ref={rackRef}
        className={styles.recordRack}
        data-rack
        tabIndex={0}
        aria-label="Kanye West record collection, interactive three-dimensional album shelf"
        aria-describedby="vinyl-status"
        onPointerDown={handleRackPointerDown}
        onPointerMove={handleRackPointerMove}
        onPointerUp={finishRackGesture}
        onPointerCancel={finishRackGesture}
        onWheel={handleShelfWheel}
        onKeyDown={handleRackKeyDown}
      >
        <div className={styles.rackBackdrop} aria-hidden="true" />
        <header className={styles.rackHeader} aria-hidden="true">
          <span>Albums</span>
          <span>Drag to browse · Click to pull</span>
        </header>
        <div className={styles.focusGlow} aria-hidden="true" />
        <div className={styles.rackTrack}>
          <ShelfItems
            activeIndex={activeIndex}
            phase={phase}
            focusAlbum={focusAlbum}
            shelfItemRefs={shelfItemRefs}
            slotRefs={slotRefs}
          />
        </div>
        <div
          key={`readout-${vinylAlbums[activeIndex].id}`}
          className={styles.activeAlbumReadout}
          aria-hidden="true"
        >
          <strong>{vinylAlbums[activeIndex].title}</strong>
          <span>
            {vinylAlbums[activeIndex].artist} · {vinylAlbums[activeIndex].year}
          </span>
        </div>
        <div className={styles.rackProgress} aria-hidden="true">
          <span />
          <span data-current="true" />
          <span />
        </div>
      </section>

      {selectedAlbum ? (
        <div className={styles.presentationLayer}>
          <button
            ref={floatingRecordRef}
            type="button"
            className={styles.floatingRecord}
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Play ${selectedTrack.title} by ${selectedTrack.artist}, paired with the ${selectedAlbum.title} sleeve`}
          >
            <VinylRecord
              album={selectedAlbum}
              playing={false}
              controlledRotation
              rotorRef={floatingRotorRef}
              className={styles.floatingVinyl}
              variant="floating"
            />
          </button>

          <button
            ref={sleeveRef}
            type="button"
            className={styles.presentedSleeve}
            style={
              {
                "--spine-color": selectedAlbum.spine,
                "--edge-color": selectedAlbum.edge,
                "--spine-ink": getContrastingInk(selectedAlbum.spine),
              } as CSSProperties
            }
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Play ${selectedTrack.title} by ${selectedTrack.artist}, paired with the ${selectedAlbum.title} sleeve`}
          >
            <span
              className={`${styles.sleeveShell} ${styles.presentedSleeveShell}`}
            >
              <span className={`${styles.sleeveFace} ${styles.sleeveFront}`}>
                <Image
                  src={selectedAlbum.cover}
                  alt={`${selectedAlbum.title} album cover`}
                  fill
                  sizes="(max-width: 720px) 82vw, 440px"
                  priority
                  draggable={false}
                />
              </span>
              <span
                className={`${styles.sleeveFace} ${styles.sleeveRear}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveLeft}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveRight}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveTop}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveBottom}`}
                aria-hidden="true"
              />
            </span>
          </button>

          <div className={styles.showcasePanel} aria-live="polite">
            <span className={styles.showcaseEyebrow}>Selected record</span>
            <h1>{selectedAlbum.title}</h1>
            <p>
              <span>
                {selectedAlbum.artist} <span aria-hidden="true">·</span>{" "}
                {selectedAlbum.year} sleeve
              </span>
              <span>
                Audio: {selectedTrack.title} <span aria-hidden="true">·</span>{" "}
                {selectedTrack.artist}
              </span>
            </p>
            <div className={styles.showcaseActions}>
              <button
                type="button"
                className={styles.showcaseSecondary}
                onClick={closeSleeve}
                disabled={phase !== "showcase"}
              >
                <X aria-hidden="true" />
                <span>Back</span>
              </button>
              <button
                type="button"
                className={styles.showcasePrimary}
                onClick={placeRecord}
                disabled={phase !== "showcase"}
              >
                <Play fill="currentColor" aria-hidden="true" />
                <span>Play CC0 track</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p id="vinyl-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </main>
  );
}
