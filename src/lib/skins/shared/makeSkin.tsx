import type { SkinMeta, SkinModule, SkinTokens } from "../types";
import { DEMO_BLOCKS, DEMO_TRIP } from "../demo";
import { SkinFrame } from "./SkinFrame";

/**
 * Builds a SkinModule from just meta + tokens. The renderer is shared
 * (SkinFrame); a new skin is one file of tokens. The Render conforms to the
 * existing SkinRenderProps ({ trip, blocks }) and defaults to the vertical
 * view; the view switcher (next PR) threads a `view` prop through SkinFrame.
 */
export function makeSkin(meta: SkinMeta, tokens: SkinTokens): SkinModule {
  return {
    // Token-driven skins render all three views via SkinFrame.
    meta: { supportsViews: true, ...meta },
    tokens,
    Render: ({ trip, blocks, view }) => <SkinFrame trip={trip} blocks={blocks} tokens={tokens} view={view} />,
    previewFixture: { trip: DEMO_TRIP, blocks: DEMO_BLOCKS },
  };
}
