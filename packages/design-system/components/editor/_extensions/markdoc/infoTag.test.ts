import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import InfoTag from './infoTag';

describe('InfoTag Extension', () => {
  it('should render an info tag with primary attribute', () => {
    const editor = new Editor({
      extensions: [StarterKit, InfoTag],
      content: {
        type: 'doc',
        content: [
          {
            type: 'infoTag',
            attrs: {
              primary: 'fieldName',
            },
          },
        ],
      },
    });

    expect(editor.getHTML()).toContain('data-primary="fieldName"');
  });

  it('should render an info tag with primary and variable attributes', () => {
    const editor = new Editor({
      extensions: [StarterKit, InfoTag],
      content: {
        type: 'doc',
        content: [
          {
            type: 'infoTag',
            attrs: {
              primary: 'fieldName',
              variable: 'varName',
            },
          },
        ],
      },
    });

    expect(editor.getHTML()).toContain('data-primary="fieldName"');
    expect(editor.getHTML()).toContain('data-variable="varName"');
  });

  it('should parse an info tag from markdown', () => {
    const editor = new Editor({
      extensions: [StarterKit, InfoTag],
      content: '{% info "fieldName" variable="varName" %}',
    });

    const json = editor.getJSON();
    expect(json.content?.[0]).toMatchObject({
      type: 'infoTag',
      attrs: {
        primary: 'fieldName',
        variable: 'varName',
      },
    });
  });
});
