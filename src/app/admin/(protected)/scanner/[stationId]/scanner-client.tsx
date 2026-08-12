"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";

type ScannerClientProps = {
  stationId: string;
  stationName: string;
  sessionCode: string;
  sessionName: string;
};

type ParticipantDisplay = {
  registrationId: string;
  fullName: string;
  institution: string;
  participantCategory: string;
};

type SessionDisplay = {
  code: string;
  name: string;
};

type SafeParticipantResult = {
  participant: ParticipantDisplay;
  session: SessionDisplay;
  checkedAt: string;
};

type SafeScanResult =
  | SafeParticipantResult & {
      status: "success" | "success-with-warning" | "already-checked-in";
      message?: string;
    }
  | {
      status:
        | "invalid-qr"
        | "cancelled-participant"
        | "invalid-station"
        | "station-not-paired"
        | "station-owned-by-other-operator"
        | "closed-session"
        | "forbidden"
        | "unauthorized"
        | "internal-error"
        | "invalid-request"
        | "network-error";
      message: string;
    };

type CameraStatus = "off" | "starting" | "ready" | "processing";

const safeMessages: Record<
  Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">,
  string
> = {
  "invalid-qr": "Kode QR tidak dikenali sebagai peserta AKKAI 2026.",
  "cancelled-participant":
    "Pendaftaran peserta telah dibatalkan. Silakan arahkan peserta ke Help Desk.",
  "invalid-station": "Station tidak dapat digunakan.",
  "station-not-paired": "Scanner belum siap digunakan. Hubungkan kembali melalui pairing.",
  "station-owned-by-other-operator": "Station ini terikat ke operator lain.",
  "closed-session": "Check-in belum dapat dilakukan pada sesi ini.",
  forbidden: "Anda tidak memiliki akses untuk melakukan scan.",
  unauthorized: "Authentication diperlukan.",
  "internal-error": "Terjadi kendala saat memproses scan. Silakan coba kembali.",
  "invalid-request": "Data scan belum sesuai. Silakan coba kembali.",
  "network-error": "Periksa koneksi internet lalu coba kembali.",
};

const knownErrorStatuses = new Set<
  Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">
>([
  "invalid-qr",
  "cancelled-participant",
  "invalid-station",
  "station-not-paired",
  "station-owned-by-other-operator",
  "closed-session",
  "forbidden",
  "unauthorized",
  "internal-error",
  "invalid-request",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readParticipant(value: unknown): ParticipantDisplay | null {
  if (!isRecord(value)) {
    return null;
  }

  const registrationId = value.registrationId;
  const fullName = value.fullName;
  const institution = value.institution;
  const participantCategory = value.participantCategory;

  if (
    typeof registrationId !== "string" ||
    typeof fullName !== "string" ||
    typeof institution !== "string" ||
    typeof participantCategory !== "string"
  ) {
    return null;
  }

  return {
    registrationId,
    fullName,
    institution,
    participantCategory,
  };
}

function readSession(value: unknown): SessionDisplay | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.code !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    code: value.code,
    name: value.name,
  };
}

function readParticipantResult(
  payload: Record<string, unknown>,
): SafeParticipantResult | null {
  const participant = readParticipant(payload.participant);
  const session = readSession(payload.session);
  const checkedAt = payload.checkedAt;

  if (!participant || !session || typeof checkedAt !== "string") {
    return null;
  }

  return {
    participant,
    session,
    checkedAt,
  };
}

function parseScanResponse(payload: unknown, httpStatus: number): SafeScanResult {
  if (!isRecord(payload) || typeof payload.status !== "string") {
    return {
      status: "internal-error",
      message: safeMessages["internal-error"],
    };
  }

  const status = payload.status;

  if (
    status === "success" ||
    status === "success-with-warning" ||
    status === "already-checked-in"
  ) {
    const participantResult = readParticipantResult(payload);

    if (!participantResult) {
      return {
        status: "internal-error",
        message: safeMessages["internal-error"],
      };
    }

    if (status === "success-with-warning") {
      return {
        status,
        ...participantResult,
        message:
          "Peserta berhasil check-in untuk sesi seminar, tetapi belum tercatat pada sesi kedatangan (ARRIVAL).",
      };
    }

    return {
      status,
      ...participantResult,
      ...(status === "already-checked-in"
        ? { message: "Peserta sudah check-in pada sesi ini." }
        : {}),
    };
  }

  if (knownErrorStatuses.has(status as Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">)) {
    return {
      status: status as Exclude<
        SafeScanResult["status"],
        "success" | "success-with-warning" | "already-checked-in" | "network-error"
      >,
      message:
        safeMessages[
          status as Exclude<
            SafeScanResult["status"],
            "success" | "success-with-warning" | "already-checked-in"
          >
        ],
    };
  }

  if (httpStatus === 401) {
    return {
      status: "unauthorized",
      message: safeMessages.unauthorized,
    };
  }

  if (httpStatus === 403) {
    return {
      status: "forbidden",
      message: safeMessages.forbidden,
    };
  }

  return {
    status: "internal-error",
    message: safeMessages["internal-error"],
  };
}

function formatCheckedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function cameraErrorMessage(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return "Izin kamera diperlukan untuk melakukan scan.";
  }

  return "Kamera tidak dapat digunakan. Periksa izin kamera lalu coba kembali.";
}

export function ScannerClient({
  stationId,
  stationName,
  sessionName,
}: ScannerClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const startingRef = useRef(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SafeScanResult | null>(null);

  function stopVideoTracks() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const stream = video.srcObject;

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    video.pause();
    video.srcObject = null;
  }

  function stopCamera() {
    generationRef.current += 1;

    try {
      controlsRef.current?.stop();
    } catch {
      // Camera cleanup should remain safe if the browser already stopped it.
    }

    controlsRef.current = null;
    readerRef.current = null;
    stopVideoTracks();
    startingRef.current = false;

    if (mountedRef.current && !processingRef.current) {
      setCameraStatus("off");
    }
  }

  async function submitScan(qrValue: string) {
    try {
      const response = await fetch("/admin/scanner/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ stationId, qrValue }),
      });

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const result = parseScanResponse(payload, response.status);

      if (mountedRef.current) {
        setScanResult(result);
      }
    } catch {
      if (mountedRef.current) {
        setScanResult({
          status: "network-error",
          message: safeMessages["network-error"],
        });
      }
    } finally {
      processingRef.current = false;

      if (mountedRef.current) {
        setCameraStatus("off");
      }
    }
  }

  async function startCamera() {
    if (
      startingRef.current ||
      processingRef.current ||
      cameraStatus === "ready"
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera tidak dapat digunakan pada browser ini.");
      setCameraStatus("off");
      return;
    }

    startingRef.current = true;
    const generation = ++generationRef.current;
    setCameraError(null);
    setCameraStatus("starting");

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanSuccess: 500,
      delayBetweenScanAttempts: 200,
    });

    readerRef.current = reader;

    try {
      const video = videoRef.current;

      if (!video) {
        throw new Error("Video preview is unavailable.");
      }

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
        },
        video,
        (result) => {
          if (!result || processingRef.current) {
            return;
          }

          processingRef.current = true;
          setCameraStatus("processing");
          stopCamera();

          const qrValue = result.getText();
          void submitScan(qrValue);
        },
      );

      if (
        generation !== generationRef.current ||
        processingRef.current ||
        !mountedRef.current
      ) {
        controls.stop();
        stopVideoTracks();
        return;
      }

      controlsRef.current = controls;
      setCameraStatus("ready");
    } catch (error) {
      const wasCancelled = generation !== generationRef.current;
      stopCamera();

      if (mountedRef.current && !processingRef.current && !wasCancelled) {
        setCameraError(cameraErrorMessage(error));
        setCameraStatus("off");
      }
    } finally {
      startingRef.current = false;
    }
  }

  function handleNextScan() {
    if (processingRef.current) {
      return;
    }

    setScanResult(null);
    setCameraError(null);
    void startCamera();
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;

      try {
        controlsRef.current?.stop();
      } catch {
        // The browser may have already released the camera during navigation.
      }

      controlsRef.current = null;
      readerRef.current = null;
      stopVideoTracks();
    };
  }, []);

  const hasResult = scanResult !== null;
  const isCameraActive = cameraStatus === "starting" || cameraStatus === "ready";
  const cameraStatusLabel = {
    off: "Kamera belum aktif",
    starting: "Menyiapkan kamera...",
    ready: "Kamera aktif",
    processing: "Memproses QR...",
  }[cameraStatus];

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-6">
      <section className="mx-auto max-w-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#dfd3bf] pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.2em] text-[#9a7526]">AKKAI 2026</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight tracking-tight text-[#142842] sm:text-2xl">
              {sessionName}
            </h1>
          </div>
          <nav aria-label="Navigasi scanner" className="flex shrink-0 items-center gap-3 pt-1 text-sm font-semibold">
            <Link
              className="rounded-md px-1 py-1 text-[#344d68] underline decoration-[#b99a5a] underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
              href="/admin/dashboard"
            >
              <span className="sm:hidden">Kembali</span>
              <span className="hidden sm:inline">Kembali ke Dashboard</span>
            </Link>
            <Link
              className="hidden rounded-md px-1 py-1 text-[#344d68] underline decoration-[#b99a5a] underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:inline"
              href="/admin/scanner/pair"
            >
              Pairing
            </Link>
          </nav>
        </header>

        <section className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#e4d8c4] bg-[#fffdf8] px-4 py-3" aria-label="Konteks scanner">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#897657]">Station</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#142842]">{stationName}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf7ef] px-3 py-1.5 text-xs font-bold text-[#267044]">
            <span aria-hidden="true">●</span>
            Sesi Aktif
          </span>
        </section>

        {!hasResult ? (
          <section className="mt-4 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-3 shadow-[0_6px_20px_rgba(20,40,66,0.06)] sm:p-5" aria-label="Kamera scanner">
            <div className={`relative overflow-hidden rounded-xl bg-[#142842] ${isCameraActive ? "aspect-[3/4] sm:aspect-video" : "aspect-[4/3] sm:aspect-video"}`}>
              <video
                aria-label="Preview kamera scanner"
                autoPlay
                className={`h-full w-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                muted
                playsInline
                ref={videoRef}
              />
              {isCameraActive ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                  <div className="h-2/3 w-2/3 rounded-2xl border-2 border-[#d9ad45] shadow-[0_0_0_999px_rgba(20,40,66,0.3)]" />
                  <p className="absolute bottom-5 text-center text-sm font-medium text-white drop-shadow-sm">
                    Arahkan QR peserta ke dalam bingkai
                  </p>
                </div>
              ) : cameraStatus === "processing" ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#f7f3ea]" role="status" aria-live="polite">
                  <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d9ad45] text-2xl text-[#d9ad45]">...</span>
                  <div>
                    <p className="text-base font-semibold">Memproses QR...</p>
                    <p className="mt-1 text-sm text-[#d8d5cc]">Tunggu sebentar.</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#f7f3ea]">
                  <span aria-hidden="true" className="relative flex h-14 w-16 items-center justify-center rounded-xl border-2 border-[#d9ad45]">
                    <span className="h-7 w-7 rounded-full border-2 border-[#d9ad45]" />
                    <span className="absolute -right-1 top-2 h-3 w-3 rounded-full bg-[#d9ad45]" />
                  </span>
                  <div>
                    <p className="text-base font-semibold">Kamera belum aktif</p>
                    <p className="mt-1 max-w-xs text-sm leading-5 text-[#d8d5cc]">
                      Aktifkan kamera untuk mulai memindai QR peserta.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 px-1 text-sm" role="status" aria-live="polite">
              <span aria-hidden="true" className={cameraStatus === "ready" ? "text-[#267044]" : cameraStatus === "processing" ? "text-[#9a7526]" : "text-[#897657]"}>●</span>
              <span className="font-medium text-[#344d68]">{cameraStatusLabel}</span>
            </div>

            {cameraError ? (
              <p className="mt-3 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-3 text-sm leading-5 text-[#9b3d31]" role="alert">
                {cameraError}
              </p>
            ) : null}

            <div className="mt-4">
              {cameraStatus === "ready" ? (
                <button
                  className="min-h-12 w-full rounded-lg border border-[#b99a5a] px-4 py-3 text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={stopCamera}
                  type="button"
                >
                  Hentikan Kamera
                </button>
              ) : cameraStatus === "processing" ? (
                <button
                  className="min-h-12 w-full rounded-lg bg-[#d9d1c2] px-4 py-3 text-sm font-semibold text-[#6b6a66]"
                  disabled
                  type="button"
                >
                  Memproses QR...
                </button>
              ) : (
                <button
                  className="min-h-12 w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={cameraStatus === "starting"}
                  onClick={() => void startCamera()}
                  type="button"
                >
                  {cameraStatus === "starting" ? "Menyiapkan Kamera..." : "Mulai Kamera"}
                </button>
              )}
            </div>

            <div className="mt-3 border-t border-[#eee6d8] pt-3 text-center">
              <Link
                className="inline-flex min-h-11 items-center rounded-md px-2 py-2 text-sm font-medium text-[#6d531e] underline decoration-[#b99a5a] underline-offset-4 outline-none hover:text-[#142842] focus-visible:ring-2 focus-visible:ring-[#9a7526]"
                href={`/admin/scanner/${stationId}/manual`}
              >
                QR bermasalah? Check-in Manual
              </Link>
            </div>
          </section>
        ) : (
          <section
            className={`mt-4 rounded-2xl border p-5 shadow-[0_6px_20px_rgba(20,40,66,0.06)] sm:p-6 ${
              scanResult.status === "success"
                ? "border-[#b9dec8] bg-[#f3fbf5]"
                : scanResult.status === "success-with-warning"
                  ? "border-[#e5cb8c] bg-[#fff9eb]"
                  : scanResult.status === "already-checked-in"
                    ? "border-[#b8cce2] bg-[#f3f8fd]"
                    : "border-[#ead3cc] bg-[#fff5f2]"
            }`}
            role={scanResult.status === "network-error" || scanResult.status === "internal-error" ? "alert" : "status"}
            aria-live="polite"
          >
            <ScanResultView result={scanResult} />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="min-h-12 w-full rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-[#203d5d] focus-visible:ring-2 focus-visible:ring-[#9a7526] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cameraStatus === "processing"}
                onClick={handleNextScan}
                type="button"
              >
                {scanResult.status === "success" || scanResult.status === "success-with-warning" || scanResult.status === "already-checked-in"
                  ? "Scan Peserta Berikutnya"
                  : "Coba Lagi"}
              </button>
              {scanResult.status === "invalid-station" ||
              scanResult.status === "station-not-paired" ||
              scanResult.status === "station-owned-by-other-operator" ? (
                <Link
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:w-auto"
                  href="/admin/scanner/pair"
                >
                  Kembali ke Pairing
                </Link>
              ) : null}
              {scanResult.status === "closed-session" ||
              scanResult.status === "forbidden" ||
              scanResult.status === "unauthorized" ? (
                <Link
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] outline-none transition hover:bg-[#fbf5e8] focus-visible:ring-2 focus-visible:ring-[#9a7526] sm:w-auto"
                  href="/admin/dashboard"
                >
                  Kembali ke Dashboard
                </Link>
              ) : null}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function ScanResultView({ result }: { result: SafeScanResult }) {
  if (
    result.status === "success" ||
    result.status === "success-with-warning" ||
    result.status === "already-checked-in"
  ) {
    const heading =
      result.status === "success"
        ? "CHECK-IN BERHASIL"
        : result.status === "success-with-warning"
          ? "CHECK-IN SEMINAR BERHASIL DENGAN CATATAN"
          : "SUDAH CHECK-IN";
    const stateMark = result.status === "success" ? "✓" : result.status === "success-with-warning" ? "!" : "i";
    const stateMarkClass = result.status === "success" ? "bg-[#267044] text-white" : result.status === "success-with-warning" ? "bg-[#b78a2b] text-white" : "bg-[#47739b] text-white";

    return (
      <div>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold ${stateMarkClass}`}>
            {stateMark}
          </span>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6d531e]">
            {heading}
          </p>
        </div>
        <h2 className="mt-5 break-words text-3xl font-bold leading-tight tracking-tight text-[#142842] sm:text-4xl">
          {result.participant.fullName}
        </h2>
        <dl className="mt-6 grid gap-4 text-sm text-[#344d68] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Registration ID
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.registrationId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Institusi
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.institution}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Kategori
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.participantCategory}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Session
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.session.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Waktu Check-in
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {formatCheckedAt(result.checkedAt)}
            </dd>
          </div>
        </dl>
        {result.message ? (
          <p className="mt-5 rounded-lg bg-white/70 p-4 text-sm font-medium leading-5 text-[#6d531e]">
            {result.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b94b3e] text-xl font-bold text-white">
          !
        </span>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#9b3d31]">
          {errorTitle(result.status)}
        </p>
      </div>
      <p className="mt-5 text-base font-medium leading-6 text-[#5f302b]">{result.message}</p>
    </div>
  );
}

function errorTitle(status: Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">) {
  switch (status) {
    case "invalid-qr":
      return "QR tidak valid";
    case "cancelled-participant":
      return "Check-in tidak dapat dilakukan";
    case "closed-session":
      return "Sesi belum aktif";
    case "network-error":
      return "Koneksi bermasalah";
    case "internal-error":
      return "Scan belum tersimpan";
    case "invalid-station":
    case "station-not-paired":
    case "station-owned-by-other-operator":
      return "Scanner tidak siap";
    case "forbidden":
    case "unauthorized":
      return "Akses scanner diperlukan";
    case "invalid-request":
      return "Data scan tidak sesuai";
  }
}
