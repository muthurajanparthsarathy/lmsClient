/** These pages supply their own skeletons instead of the global preloader. */
export function usesClientWorkspaceSkeleton(pathname: string): boolean {
  return /^\/lms\/pages\/(clientmanagement|servicemapping|businessmanagement)(?:\/|\?|#|$)/.test(pathname);
}
