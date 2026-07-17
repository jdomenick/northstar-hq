// Re-export centralized limits so automation modules never reach for magic
// numbers directly and callers have one import surface.

export { AUTOMATION_LIMITS } from "@/lib/constants";