// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createDefaultApp, createDefaultChoice, createDefaultRow } from "@shared/cyoa";
import { useCyoa, type UseCyoaResult } from "./use-cyoa";
import { useViewerAudio } from "./useViewerAudio";

let root: Root | undefined;
let host: HTMLDivElement;
let player: UseCyoaResult;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(useAudioURL: boolean) {
  const app = createDefaultApp();
  const row = createDefaultRow(app, 0);
  const choice = createDefaultChoice(app, 0);
  Object.assign(choice, { setBgmIsOn: true, bgmId: "example-track", useAudioURL });
  row.objects = [choice];
  app.rows = [row];
  function Harness() {
    player = useCyoa({ app });
    const audio = useViewerAudio(player);
    return <audio ref={audio.audioRef} />;
  }
  act(() => {
    root = createRoot(host);
    root.render(<Harness />);
  });
  return { choice, row };
}

it("pauses the captured audio element after React has detached its ref", async () => {
  const { choice, row } = mount(true);
  await act(async () => {
    player.toggleChoice(choice, row);
  });
  const pause = vi.spyOn(host.querySelector("audio")!, "pause");
  pause.mockClear();
  act(() => root!.unmount());
  root = undefined;
  expect(pause).toHaveBeenCalledOnce();
});

it("does not construct a late YouTube player after the viewer unmounts", async () => {
  const createPlayer = vi.fn();
  vi.stubGlobal("YT", { Player: createPlayer });
  const { choice, row } = mount(false);
  act(() => {
    player.toggleChoice(choice, row);
  });
  // The API promise resolves in a microtask, after this synchronous teardown.
  act(() => root!.unmount());
  root = undefined;
  await act(async () => {});
  expect(createPlayer).not.toHaveBeenCalled();
});
