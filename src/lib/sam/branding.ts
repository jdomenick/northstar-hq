import northstarMark from "@/assets/northstar-logo-mark.png.asset.json";

/**
 * SAM identity mark.
 *
 * The project does not currently ship a dedicated SAM atom asset, so the
 * closest official NorthStar mark is used. Swap the source here (single point
 * of configuration) once the exact SAM atom file is added to `src/assets`.
 */
export const SAM_MARK_SRC: string = northstarMark.url;

export const SAM_NAME = "SAM";
export const SAM_FULL_NAME = "Strategic Asset Manager";
