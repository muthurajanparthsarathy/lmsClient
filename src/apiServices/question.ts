import axios from 'axios';

const BASE_URL = 'https://lmsserver-yeve.onrender.com';

// Interfaces
export interface HintData {
  hintText: string;
  pointsDeduction: number;
  isPublic: boolean;
  sequence: number;
}

export interface TestCaseData {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
  points?: number;
  explanation?: string;
  sequence: number;
}

export interface MCQQuestionData {
  questionType: 'mcq';
  mcqQuestion: {
    questionTitle: string;
    options: string[];
    correctAnswer: string;
  };
  isActive: boolean;
  sequence: number;
}

export interface ProgrammingQuestionData {
  questionType: 'programming';
  programmingQuestion: {
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    sampleInput?: string;
    sampleOutput?: string;
    constraints: string[];
    hints: HintData[];
    testCases: TestCaseData[];
    solutions: {
      startedCode: string;
      functionName: string;
      language: string;
    };
    timeLimit: number;
    memoryLimit: number;
    isActive: boolean;
    sequence: number;
  };
  isActive: boolean;
  sequence: number;
}

export type QuestionData = MCQQuestionData | ProgrammingQuestionData;

export interface QuestionResponse {
  success: boolean;
  message: Array<{ key: string; value: string }>;
  data: {
    question: any;
    questionId: string;
  };
}

export const questionApi = {
  // Add a new question
  addQuestion: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionData: any,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      // Check if this is FormData (image uploads)
      const isFormData = questionData instanceof FormData;
      
      // Determine URL - always use MCQ endpoint for FormData with images
      let url;
      
      if (isFormData) {
        url = `${BASE_URL}/mcq-question-add/${entityType}/${entityId}/exercise/${exerciseId}`;
        console.log('📌 Using MCQ-specific endpoint with FormData:', url);
        
        // Ensure FormData has all required fields
        if (!questionData.has('tabType')) {
          questionData.append('tabType', tabType);
        }
        if (!questionData.has('subcategory')) {
          questionData.append('subcategory', subcategory);
        }
        
        // Log FormData contents
        console.log('📤 FormData contents:');
        for (let pair of questionData.entries()) {
          if (pair[1] instanceof File) {
            console.log(`  - ${pair[0]}: File (${(pair[1] as File).name})`);
          } else {
            console.log(`  - ${pair[0]}: ${String(pair[1]).substring(0, 100)}...`);
          }
        }
      } else {
        // Check if this is MCQ or Programming
        const isMCQQuestion = 
          (Array.isArray(questionData) && questionData[0]?.questionType === 'mcq') ||
          (!Array.isArray(questionData) && questionData.questionType === 'mcq') ||
          (Array.isArray(questionData) && questionData[0]?.mcqQuestionTitle) ||
          (!Array.isArray(questionData) && questionData.mcqQuestionTitle);
        
        url = isMCQQuestion
          ? `${BASE_URL}/mcq-question-add/${entityType}/${entityId}/exercise/${exerciseId}`
          : `${BASE_URL}/question-add/${entityType}/${entityId}/exercise/${exerciseId}`;
      }
     
      const token = localStorage.getItem("smartcliff_token");
      
      let response;
      
      if (isFormData) {
        // ✅ SEND AS MULTIPART/FORM-DATA
        response = await axios.post(url, questionData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          timeout: 60000,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              console.log(`📤 Upload progress: ${percentCompleted}%`);
            }
          }
        });
      } else {
        // ✅ SEND AS JSON
        let payload: any = {
          tabType,
          subcategory
        };
        
        if (Array.isArray(questionData)) {
          // 🆕 Preserve sectionId if present in question data
          payload.questionsData = questionData.map(q => ({
            ...q,
            sectionId: q.sectionId || null
          }));
        } else {
          // 🆕 Preserve sectionId if present in question data
          payload.questionsData = [{
            ...questionData,
            sectionId: questionData.sectionId || null
          }];
        }
        
        const cleanPayload = JSON.parse(JSON.stringify(payload));
        
        response = await axios.post(url, cleanPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000,
        });
      }
   
      console.log(`✅ Question(s) added successfully:`, response.data);
      return response.data;
     
    } catch (error: any) {
      console.error('❌ Error adding question(s):', error);
      if (error.response) {
        console.error('❌ Response data:', error.response.data);
      }
      throw error;
    }
  },

  // Update a programming question
  updateQuestion: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionId: string,
    questionData: any,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      // Note: The URL pattern matches your backend: /question-update/:type/:id/:exerciseId/:questionId
      const url = `${BASE_URL}/question-update/${entityType}/${entityId}/${exerciseId}/${questionId}`;
      
      const token = localStorage.getItem("smartcliff_token");
      
      const singleQuestion = Array.isArray(questionData) ? questionData[0] : questionData;
      
      const payload = {
        tabType,
        subcategory,
        questionData: {
          ...singleQuestion,
          sectionId: singleQuestion.sectionId !== undefined ? singleQuestion.sectionId : null // 🆕 Include sectionId
        },
        ...singleQuestion,
        sectionId: singleQuestion.sectionId !== undefined ? singleQuestion.sectionId : null // 🆕 Include sectionId for backward compatibility
      };
      
      const cleanPayload = JSON.parse(JSON.stringify(payload));
      
      console.log('📤 Updating question:', {
        url,
        entityType,
        entityId,
        exerciseId,
        questionId,
        tabType,
        subcategory,
        sectionId: singleQuestion.sectionId // 🆕 Log sectionId
      });
      
      const response = await axios.put(url, cleanPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      });
      
      console.log('✅ Question updated successfully:', response.data);
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Error updating question:', error);
      if (error.response) {
        console.error('❌ Response data:', error.response.data);
        console.error('❌ Response status:', error.response.status);
      }
      throw error;
    }
  },

  // Update MCQ question API
  updateMCQQuestion: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionId: string,
    block: any,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      const url = `${BASE_URL}/${entityType}/${entityId}/exercise/${exerciseId}/mcq/question/${questionId}`;
      const token = localStorage.getItem('smartcliff_token');

      const base64ToFile = (b64: string, name: string): File | null => {
        try {
          const m = b64.match(/^data:([^;]+);base64,(.+)$/);
          if (!m) return null;
          const bytes = atob(m[2]);
          const buf = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
          return new File([buf], name, { type: m[1] });
        } catch { return null; }
      };

      const typeMap: Record<string, string> = {
        'multiple-choice': 'multiple_choice',
        'multiple-select': 'multiple_select',
        'true-false': 'true_false',
        'short-answer': 'short_answer',
        paragraph: 'essay',
        matching: 'matching',
        ordering: 'ordering',
        numeric: 'numeric',
        dropdown: 'dropdown',
        checkboxes: 'checkboxes',
      };

      const OPTION_BASED_TYPES = ['multiple-choice', 'multiple-select', 'dropdown', 'checkboxes'];
      const isOptionBased = OPTION_BASED_TYPES.includes(block.type);

      const correctOptions = isOptionBased ? (block.options || []).filter((o: any) => o.isCorrect) : [];
      const correctAnswers = isOptionBased
        ? (block.type === 'multiple-select'
            ? correctOptions.map((o: any) => o.text.trim())
            : correctOptions.length
            ? [correctOptions[0].text.trim()]
            : [])
        : [];

      const hasBase64Images =
        block.questionImageUrl?.startsWith('data:') ||
        (isOptionBased && (block.options || []).some((o: any) => o.imageUrl?.startsWith('data:')));

      const buildQuestionData = (opts: any[], qImgPath: string | null) => {
        const contentToStore = block.questionContent && block.questionContent.length > 0
          ? block.questionContent
          : [{ id: 'txt-1', type: 'text', value: block.questionText?.trim() || '' }];

        const qData: any = {
          mcqQuestionTitle: contentToStore,
          mcqQuestionType: typeMap[block.type] || 'multiple_choice',
          mcqQuestionDifficulty: block.difficulty || undefined,
          mcqQuestionScore: block.score ?? 0,
          mcqQuestionTimeLimit: block.timeLimit || 0,
          isActive: block.isActive !== undefined ? block.isActive : true,
          mcqQuestionOptionsPerRow: block.optionsPerRow || 1,
          mcqQuestionOptions: opts,
          mcqQuestionCorrectAnswers: correctAnswers,
          mcqQuestionRequired: block.isRequired === true,
          hasOtherOption: block.hasOtherOption || false,
          mcqQuestionImageUrl: qImgPath || null,
          questionType: 'mcq',
          sequence: block.sequence ?? 0,
          sectionId: block.sectionId || null, // 🆕 Include sectionId
          // Source tag: only sent when the block carries one — the server
          // preserves the stored tag when the field is absent, so legacy
          // untagged edits can't wipe anything.
          ...(block.source ? { source: block.source } : {}),
          hasExplanation: block.hasExplanation || false,
          ...(block.hasExplanation && block.explanation?.trim()
            ? { mcqQuestionDescription: block.explanation.trim() }
            : {}),
        };

        // Type-specific answer fields
        if (block.type === 'true-false') {
          qData.trueFalseAnswer = block.trueFalseAnswer ?? null;
        }
        if (block.type === 'short-answer') {
          qData.shortAnswer = block.shortAnswer || '';
        }
        if (block.type === 'numeric') {
          qData.numericAnswer = block.numericAnswer ?? null;
          qData.numericTolerance = block.numericTolerance ?? null;
        }
        if (block.type === 'matching') {
          qData.matchingPairs = (block.matchingPairs || []).map((p: any) => ({
            left: p.left || '',
            right: p.right || '',
          }));
        }
        if (block.type === 'ordering') {
          qData.orderingItems = (block.orderingItems || []).map((item: any) => ({
            text: item.text || '',
            order: item.order || 0,
          }));
        }

        return qData;
      };

      if (hasBase64Images) {
        const fd = new FormData();
        fd.append('tabType', tabType);
        fd.append('subcategory', subcategory);

        const opts = isOptionBased
          ? (block.options || []).map((o: any, oi: number) => {
              let imgPath = o.imageUrl || null;
              if (o.imageUrl?.startsWith('data:')) {
                const fn = `option_update_${questionId}_${oi}_${Date.now()}.jpg`;
                imgPath = `/uploads/${fn}`;
                const f = base64ToFile(o.imageUrl, fn);
                if (f) fd.append(`option_${oi}_image`, f);
              }
              return {
                text: o.text.trim(), isCorrect: o.isCorrect,
                imageUrl: imgPath,
                imageAlignment: o.imageAlignment || 'left',
                imageSizePercent: o.imageSizePercent || 100,
              };
            })
          : [];

        let qImgPath = block.questionImageUrl || null;
        if (block.questionImageUrl?.startsWith('data:')) {
          const fn = `question_update_${questionId}_${Date.now()}.jpg`;
          qImgPath = `/uploads/${fn}`;
          const f = base64ToFile(block.questionImageUrl, fn);
          if (f) fd.append('questionImage', f);
        }

        fd.append('questionData', JSON.stringify(buildQuestionData(opts, qImgPath)));

        const response = await axios.put(url, fd, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
          timeout: 60000,
        });
        return response.data;

      } else {
        const opts = isOptionBased
          ? (block.options || []).map((o: any) => ({
              text: o.text.trim(), isCorrect: o.isCorrect,
              imageUrl: o.imageUrl || null,
              imageAlignment: o.imageAlignment || 'left',
              imageSizePercent: o.imageSizePercent || 100,
            }))
          : [];

        const payload = {
          tabType,
          subcategory,
          questionData: buildQuestionData(opts, block.questionImageUrl || null),
        };

        const response = await axios.put(url, payload, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          timeout: 30000,
        });
        return response.data;
      }

    } catch (error: any) {
      console.error('❌ Error updating MCQ question:', error);
      if (error.response) console.error('❌ Response:', error.response.data);
      throw error;
    }
  },

  // Delete MCQ question
  deleteMCQQuestion: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionId: string,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      const url = `${BASE_URL}/${entityType}/${entityId}/exercise/${exerciseId}/mcq/question/${questionId}`;
      const token = localStorage.getItem('smartcliff_token');
      const response = await axios.delete(url, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        data: { tabType, subcategory },
        timeout: 30000,
      });
      console.log('✅ MCQ question deleted:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error deleting MCQ question:', error);
      if (error.response) console.error('❌ Response:', error.response.data);
      throw error;
    }
  },

  // Delete a question
  deleteQuestion: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionId: string,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      const url = `${BASE_URL}/question-delete/${entityType}/${entityId}/${exerciseId}/${questionId}`;
      
      console.log('🗑️ DELETE Request:', {
        url,
        tabType,
        subcategory,
        entityType,
        entityId,
        exerciseId,
        questionId
      });

      const token = localStorage.getItem("smartcliff_token");
      
      const response = await axios.delete(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          tabType,
          subcategory
        },
        timeout: 30000,
      });

      console.log('✅ Question deleted successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error deleting question:', error);
      if (error.response) {
        console.error('❌ Response error:', error.response.data);
        console.error('❌ Response status:', error.response.status);
      }
      throw error;
    }
  },

  // 🆕 NEW: Get questions filtered by section
  getQuestionsBySection: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    sectionId: string,
    includeInactive: boolean = false
  ): Promise<any> => {
    try {
      const url = `${BASE_URL}/question-get/${entityType}/${entityId}/${exerciseId}?sectionId=${sectionId}&includeInactive=${includeInactive}`;
      const token = localStorage.getItem("smartcliff_token");
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      });
      
      console.log(`✅ Questions fetched for section ${sectionId}:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching questions by section:', error);
      throw error;
    }
  },

  // 🆕 NEW: Bulk update section assignment for questions
  bulkUpdateSection: async (
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics',
    entityId: string,
    exerciseId: string,
    questionIds: string[],
    newSectionId: string,
    tabType: string,
    subcategory: string
  ): Promise<any> => {
    try {
      const token = localStorage.getItem("smartcliff_token");
      const updatePromises = questionIds.map(questionId => {
        const url = `${BASE_URL}/question-update/${entityType}/${entityId}/${exerciseId}/${questionId}`;
        return axios.put(url, {
          tabType,
          subcategory,
          questionData: { sectionId: newSectionId },
          sectionId: newSectionId
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000,
        });
      });
      
      const results = await Promise.all(updatePromises);
      console.log(`✅ Bulk section update completed for ${questionIds.length} questions`);
      return results.map(r => r.data);
    } catch (error: any) {
      console.error('❌ Error in bulk section update:', error);
      throw error;
    }
  }
};