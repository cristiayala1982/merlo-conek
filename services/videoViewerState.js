let currentVideoViewerPayload = null;

export function setVideoViewerPayload(payload) {
  currentVideoViewerPayload = payload || null;
}

export function getVideoViewerPayload() {
  return currentVideoViewerPayload;
}

export function clearVideoViewerPayload() {
  currentVideoViewerPayload = null;
}
