import type { Node } from '@markdoc/markdoc';

/**
 * Validation utilities for switch tag parsing optimization
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a switch tag node structure
 */
export function validateSwitchTag(node: Node): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if switch has a primary attribute
  if (!node.attributes?.primary) {
    result.errors.push('Switch tag missing primary attribute');
    result.isValid = false;
  }

  // Check for children
  if (!node.children || !Array.isArray(node.children)) {
    result.errors.push('Switch tag has no children');
    result.isValid = false;
    return result;
  }

  // Count case tags
  const caseTags = node.children.filter(child => 
    child.type === 'tag' && child.tag === 'case'
  );

  if (caseTags.length === 0) {
    result.errors.push('Switch tag contains no case tags');
    result.isValid = false;
  }

  // Check for non-case content
  const nonCaseChildren = node.children.filter(child => 
    !(child.type === 'tag' && child.tag === 'case') &&
    !(child.type === 'text' && (!child.attributes?.content || child.attributes.content.trim() === '')) &&
    !(child.type === 'softbreak' || child.type === 'hardbreak')
  );

  if (nonCaseChildren.length > 0) {
    result.warnings.push(`Switch tag contains ${nonCaseChildren.length} non-case children: ${
      nonCaseChildren.map(child => `${child.type}${child.tag ? ':' + child.tag : ''}`).join(', ')
    }`);
  }

  return result;
}

/**
 * Validates a case tag node structure
 */
export function validateCaseTag(node: Node): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Case tags can have empty primary attributes (for default cases)
  if (node.attributes?.primary === undefined) {
    result.warnings.push('Case tag has undefined primary attribute (may be intentional for default case)');
  }

  // Check for meaningful content
  if (node.children && Array.isArray(node.children)) {
    const hasContent = node.children.some(child => {
      if (child.type === 'text') {
        return child.attributes?.content && child.attributes.content.trim().length > 0;
      }
      return child.type !== 'softbreak' && child.type !== 'hardbreak';
    });

    if (!hasContent) {
      result.warnings.push('Case tag appears to have no meaningful content');
    }
  } else {
    result.warnings.push('Case tag has no children');
  }

  return result;
}

/**
 * Debug helper to analyze switch tag structure
 */
export function debugSwitchStructure(node: Node, depth = 0): void {
  const indent = '  '.repeat(depth);
  
  if (node.type === 'tag' && node.tag === 'switch') {
    console.log(`${indent}🔄 Switch: "${node.attributes?.primary || 'unnamed'}"`);
    
    const validation = validateSwitchTag(node);
    if (!validation.isValid) {
      console.log(`${indent}  ❌ Errors: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`${indent}  ⚠️  Warnings: ${validation.warnings.join(', ')}`);
    }
    
    if (node.children) {
      node.children.forEach((child, index) => {
        if (child.type === 'tag' && child.tag === 'case') {
          console.log(`${indent}  📋 Case ${index}: "${child.attributes?.primary || '(default)'}"`);
          const caseValidation = validateCaseTag(child);
          if (caseValidation.warnings.length > 0) {
            console.log(`${indent}    ⚠️  ${caseValidation.warnings.join(', ')}`);
          }
        } else {
          console.log(`${indent}  🔍 Non-case child ${index}: ${child.type}${child.tag ? ':' + child.tag : ''}`);
        }
      });
    }
  }
  
  // Recursively check children
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => debugSwitchStructure(child, depth + 1));
  }
} 