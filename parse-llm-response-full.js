try {
  // Get original data from Build LLM Prompt node (preserved in input)
  // The Set node preserves all input fields, so $input.item.json should have everything
  // Extract LLM response first (it's in $json.content as a string)
  let originalData = {};
  
  // Try to get original data from input - Set node preserves all fields
  // In runOnceForEachItem mode, we can only use $input.item.json
  if ($input && $input.item && $input.item.json) {
    originalData = { ...$input.item.json };
  } else if ($json && ($json.filepath || $json.relative_path || $json.frontmatter)) {
    // Last resort: use $json but exclude LLM response fields
    const { content, output, text, response, message, ...rest } = $json;
    originalData = rest;
  }
  
  // Handle Anthropic node response format
  let llmOutput = '';
  
  // n8n Anthropic node typically returns: { output: "..." } or { text: "..." } or direct text
  if ($json.output) {
    llmOutput = $json.output;
  } else if ($json.text) {
    llmOutput = $json.text;
  } else if ($json.content) {
    // Handle array format: { content: [{ type: "text", text: "..." }] }
    if (Array.isArray($json.content)) {
      const textContent = $json.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        llmOutput = textContent.text;
      }
    } else if (typeof $json.content === 'string') {
      llmOutput = $json.content;
    }
  } else if ($json.response) {
    llmOutput = $json.response;
  } else if ($json.message) {
    llmOutput = $json.message.content || $json.message.text || '';
  } else if (typeof $json === 'string') {
    llmOutput = $json;
  } else {
    // Try to find any text field
    llmOutput = JSON.stringify($json);
  }
  
  if (!llmOutput || llmOutput.trim() === '') {
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
  
  // Clean up response - remove markdown code blocks if present
  let cleaned = llmOutput.trim();
  cleaned = cleaned.replace(/^```json\n?/i, '');
  cleaned = cleaned.replace(/^```\n?/i, '');
  cleaned = cleaned.replace(/\n?```$/i, '');
  cleaned = cleaned.trim();
  
  // Try to extract JSON from response
  let analysis;
  try {
    analysis = JSON.parse(cleaned);
  } catch (e) {
    // Try to find JSON object in the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        return {
          json: {
            ...originalData,
            analysis: {
              meeting_type: 'unknown',
              confidence: 'low',
              needs_manual_review: true,
              error: 'Failed to parse LLM JSON response',
              raw_output: cleaned.substring(0, 500)
            },
            needs_update: false,
            needs_move: false
          }
        };
      }
    } else {
      return {
        json: {
          ...originalData,
          analysis: {
            meeting_type: 'unknown',
            confidence: 'low',
            needs_manual_review: true,
            error: 'No JSON found in LLM response',
            raw_output: cleaned.substring(0, 500)
          },
          needs_update: false,
          needs_move: false
        }
      };
    }
  }
  
  // Validate required fields
  if (!analysis.meeting_type) {
    analysis.meeting_type = 'unknown';
  }
  if (!analysis.confidence) {
    analysis.confidence = 'low';
  }
  if (analysis.needs_manual_review === undefined) {
    analysis.needs_manual_review = analysis.confidence === 'low' || !analysis.correct_folder;
  }
  
  // Ensure new optional fields have defaults if missing
  if (!analysis.confidence_reason) {
    analysis.confidence_reason = '';
  }
  if (!analysis.review_reason) {
    analysis.review_reason = '';
  }
  if (!analysis.date_detected) {
    analysis.date_detected = '';
  }
  if (!analysis.partner) {
    analysis.partner = '';
  }
  if (!analysis.team) {
    analysis.team = '';
  }
  
  // Calculate if file needs moving
  const vaultRoot = '/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1';
  // Safely get current relative path with null checks
  let currentRelative = originalData.relative_path || '';
  if (!currentRelative && originalData.filepath && typeof originalData.filepath === 'string') {
    currentRelative = originalData.filepath.replace(vaultRoot + '/', '');
  }
  const targetRelative = analysis.correct_folder || '';
  
  // Normalize paths for comparison (remove trailing slashes)
  const normalizedCurrent = (currentRelative || '').replace(/\/$/, '');
  const normalizedTarget = (targetRelative || '').replace(/\/$/, '');
  const currentDir = normalizedCurrent ? normalizedCurrent.substring(0, normalizedCurrent.lastIndexOf('/')) : '';
  
  // Only calculate move if we have both current and target paths
  const needsMove = targetRelative && 
                    targetRelative.trim() !== '' && 
                    normalizedCurrent && 
                    normalizedCurrent.trim() !== '' &&
                    currentDir !== normalizedTarget &&
                    !normalizedCurrent.startsWith(normalizedTarget + '/');
  
  // Ensure we have at least minimal originalData structure
  const resultData = {
    filepath: originalData.filepath || '',
    filename: originalData.filename || '',
    current_folder: originalData.current_folder || '',
    relative_path: originalData.relative_path || currentRelative || '',
    frontmatter: originalData.frontmatter || {},
    content: originalData.content || '',
    has_frontmatter: originalData.has_frontmatter || false,
    ...originalData
  };
  
  return {
    json: {
      ...resultData,
      analysis,
      needs_update: !analysis.needs_manual_review,
      needs_move: needsMove
    }
  };
} catch (error) {
  // Fallback: try to get original data from input or use current json
  let fallbackData = {};
  try {
    if ($input && $input.item && $input.item.json) {
      fallbackData = $input.item.json;
    } else if ($json) {
      fallbackData = $json;
    }
  } catch (e) {
    // If all else fails, use empty object
    fallbackData = $json || {};
  }
  return {
    json: {
      ...fallbackData,
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
