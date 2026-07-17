// Re-export the registry API under the platforms module name.

export {
  getSocialPlatform,
  tryGetSocialPlatform,
  listSocialPlatforms,
  isConnectorAvailable,
} from "./registry.server";