// /app/utils/urlParams.ts

export interface LMSURLParams {
  courseId: string | null;
  nodeId: string | null;
  activeTab: "I_Do" | "We_Do" | "youDo" | null;
  activeSubcategory: string | null;
  exerciseId?: string | null;
  fromAnalytics?: string | null;
  sourceTab?: string | null;
  sourceSubcategory?: string | null;
}

export const parseURLParams = (searchParams: URLSearchParams): LMSURLParams => {
  return {
    courseId: searchParams.get('courseId'),
    nodeId: searchParams.get('nodeId'),
    activeTab: searchParams.get('activeTab') as "I_Do" | "We_Do" | "youDo" | null,
    activeSubcategory: searchParams.get('activeSubcategory'),
    exerciseId: searchParams.get('exerciseId'),
    fromAnalytics: searchParams.get('fromAnalytics'),
    sourceTab: searchParams.get('sourceTab'),
    sourceSubcategory: searchParams.get('sourceSubcategory'),
  };
};

export const buildURLParams = (params: Partial<LMSURLParams>): string => {
  const urlParams = new URLSearchParams();
  
  if (params.courseId) urlParams.set('courseId', params.courseId);
  if (params.nodeId) urlParams.set('nodeId', params.nodeId);
  if (params.activeTab) urlParams.set('activeTab', params.activeTab);
  if (params.activeSubcategory) urlParams.set('activeSubcategory', params.activeSubcategory);
  if (params.exerciseId) urlParams.set('exerciseId', params.exerciseId);
  
  // Analytics params (temporary)
  if (params.fromAnalytics) urlParams.set('fromAnalytics', params.fromAnalytics);
  if (params.sourceTab) urlParams.set('sourceTab', params.sourceTab);
  if (params.sourceSubcategory) urlParams.set('sourceSubcategory', params.sourceSubcategory);
  
  return urlParams.toString();
};

// Helper function to update URL without reloading
export const updateURL = (params: Partial<LMSURLParams>, replaceState = true) => {
  const currentUrl = new URL(window.location.href);
  const currentParams = new URLSearchParams(currentUrl.search);
  
  // Update params
  if (params.courseId) currentParams.set('courseId', params.courseId);
  if (params.nodeId) currentParams.set('nodeId', params.nodeId);
  if (params.activeTab) currentParams.set('activeTab', params.activeTab);
  if (params.activeSubcategory) currentParams.set('activeSubcategory', params.activeSubcategory);
  if (params.exerciseId) currentParams.set('exerciseId', params.exerciseId);
  
  // Remove undefined/null values
  if (params.courseId === null) currentParams.delete('courseId');
  if (params.nodeId === null) currentParams.delete('nodeId');
  if (params.activeTab === null) currentParams.delete('activeTab');
  if (params.activeSubcategory === null) currentParams.delete('activeSubcategory');
  if (params.exerciseId === null) currentParams.delete('exerciseId');
  
  const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
  
  if (replaceState) {
    window.history.replaceState({}, '', newUrl);
  } else {
    window.history.pushState({}, '', newUrl);
  }
};

// Clean temporary analytics params from URL
export const cleanAnalyticsParams = () => {
  const url = new URL(window.location.href);
  ['fromAnalytics', 'sourceTab', 'sourceSubcategory'].forEach(param => 
    url.searchParams.delete(param)
  );
  window.history.replaceState({}, '', url.toString());
};