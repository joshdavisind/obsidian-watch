try {
  // MINIMAL VERSION - Sanity check
  // Get original data from input
  let originalData = {};
  if ($input && $input.item && $input.item.json) {
    originalData = $input.item.json;
  } else if ($json) {
    originalData = $json;
  }
  
  // Get LLM response (should be in $json.content as a string)
  let llmResponse = '';
  if ($json && $json.content) {
    if (typeof $json.content === 'string') {
      llmResponse = $json.content;
    } else if (Array.isArray($json.content) && $json.content[0]) {
      llmResponse = $json.content[0];
    }
  }
  
  // Parse the JSON response
  let analysis = {};
  if (llmResponse && llmResponse.trim()) {
    try {
      // Remove markdown code blocks if present
      let cleaned = llmResponse.trim();
      cleaned = cleaned.replace(/^```json\n?/i, '');
      cleaned = cleaned.replace(/^```\n?/i, '');
      cleaned = cleaned.replace(/\n?```$/i, '');
      cleaned = cleaned.trim();
      
      analysis = JSON.parse(cleaned);
    } catch (e) {
      // If parsing fails, return error
      return {
        json: {
          ...originalData,
          analysis: {
            meeting_type: 'unknown',
            confidence: 'low',
            needs_manual_review: true,
            error: 'Failed to parse LLM response: ' + e.message
          },
          needs_update: false,
          needs_move: false
        }
      };
    }
  } else {
    // No response
    return {
      json: {
        ...originalData,
        analysis: {
          meeting_type: 'unknown',
          confidence: 'low',
          needs_manual_review: true,
          error: 'Empty LLM response'
        },
        needs_update: false,
        needs_move: false
      }
    };
  }
  
  // Basic validation
  if (!analysis.meeting_type) {
    analysis.meeting_type = 'unknown';
  }
  if (!analysis.confidence) {
    analysis.confidence = 'low';
  }
  if (analysis.needs_manual_review === undefined) {
    analysis.needs_manual_review = analysis.confidence === 'low' || !analysis.correct_folder;
  }
  
  // Return merged result
  return {
    json: {
      ...originalData,
      analysis: analysis,
      needs_update: !analysis.needs_manual_review,
      needs_move: false
    }
  };
} catch (error) {
  // Fallback on any error
  return {
    json: {
      filepath: ($input && $input.item && $input.item.json && $input.item.json.filepath) || '',
      filename: ($input && $input.item && $input.item.json && $input.item.json.filename) || '',
      analysis: {
        meeting_type: 'unknown',
        confidence: 'low',
        needs_manual_review: true,
        error: error.message
      },
      needs_update: false,
      needs_move: false
    }
  };
}
