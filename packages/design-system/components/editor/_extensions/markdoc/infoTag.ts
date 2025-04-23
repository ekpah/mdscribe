import {
  Node,
  type NodeViewRendererProps,
  mergeAttributes,
  nodeInputRule,
} from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view';
// import renderItems from './markdocRenderItems.js';

// TODO: Refactor attributes to match InfoTagMenu (primary, variable)
// The current attributes (tagName) seem incorrect for InfoTag.
export interface InfoTagAttrs {
  /**
   * The tag name for the Markdoc tag (Should likely be fixed or removed for InfoTag)
   */
  tagName: string; // This seems incorrect based on InfoTagMenu usage

  /**
   * The attributes passed to the tag (Should likely be primary/variable)
   */
  attributes?: Record<string, string> | null; // This seems incorrect
  primary?: string | null;
  variable?: string | null;
}

// TODO: Review if this interface is needed for InfoTag
export interface InfoTagItem {
  tagName: string;
  attributes?: Record<string, string>;
}

export const InfoTag = Node.create<InfoTagAttrs>({
  name: 'infoTag',

  // This is needed to ensure that the markdoc tag is rendered before the default nodes
  priority: 101,

  group: 'inline',

  inline: true,

  // Make selectable to allow clicking for the menu
  selectable: true,

  atom: true,

  addAttributes() {
    // TODO: Define 'primary' and 'variable' attributes here based on InfoTagMenu
    // The current 'tagName' attribute doesn't match the expected usage.
    return {
      tagName: {
        // This attribute seems out of place for a specific InfoTag node.
        // It should probably be fixed to 'info' or removed if primary/variable are used.
        default: 'info', // Defaulting to 'info' but needs review
        parseHTML: (element) => element.getAttribute('data-tag-name'),
        renderHTML: (attributes) => {
          // This logic might need adjustment based on how attributes are finalized.
          if (!attributes.tagName) {
            return {};
          }
          return {
            'data-tag-name': attributes.tagName,
          };
        },
      },
      // Placeholder for actual attributes needed by InfoTagMenu
      primary: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-primary'),
        renderHTML: (attributes) => ({
          'data-primary': attributes.primary,
        }),
      },
    };
  },

  // TODO: Update renderText to reflect primary/variable attributes
  renderText({ node }: { node: ProseMirrorNode }) {
    // This rendering is generic and might need adjustment for InfoTag
    const primary = node.attrs.primary || '""';
    const variable = node.attrs.variable
      ? ` variable="${node.attrs.variable}"`
      : '';
    return `{% info "${primary}${variable}" /%}`;
    // Original generic rendering: return `{%${node.attrs.tagName}%}`;
  },

  renderHTML({
    HTMLAttributes,
    node,
  }: {
    HTMLAttributes: Record<string, string>;
    node: ProseMirrorNode;
  }) {
    // TODO: Update rendering to use primary/variable attributes visually
    const displayPrimary = node.attrs.primary || 'Info';
    const displayVariable = node.attrs.variable
      ? ` (${node.attrs.variable})`
      : '';

    return [
      'span',
      mergeAttributes(
        { 'data-type': 'markdoc-info' }, // Changed from 'markdocTag'
        { class: 'bg-blue-500 text-white px-2 py-1 rounded-md' },
        HTMLAttributes,
        // Store actual attributes for potential editing/parsing
        {
          'data-primary': node.attrs.primary,
          'data-variable': node.attrs.variable,
          // Keep data-tag-name for consistency? Or remove if primary/variable are sufficient.
          'data-tag-name': 'info', // Hardcoding 'info' as the tag name
        }
      ),
      // Display format: Info("primary") or Info("primary", variable="var")
      `Info(${displayPrimary}${displayVariable})`, // More descriptive rendering
      // Original generic rendering: `${node.attrs.tagName}`,
    ] as [string, Record<string, unknown>, string]; // Use unknown for attribute values
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-type="markdoc-info"]',
      },
    ];
  },

  // TODO: Review if input rule is needed/correct for InfoTag structure
  // Input rule might conflict with command insertion and specific attribute format.
  // Consider removing if insertion is only via slash command.
  addInputRules() {
    return [
      nodeInputRule({
        // Regex to match {% info "primary_value" /%} or {% info "primary_value" %}
        // It captures the primary_value inside the quotes.
        find: /{%\s*info\s+"([^"]*)"\s*\/?%}/g,
        type: this.type,
        getAttributes: (match) => {
          // match[1] contains the captured group (the primary value)
          const primary = match[1];
          return { primary: primary || null }; // Set primary attribute, default to null if empty string
        },
      }),
    ];
  },

  addNodeView() {
    // Explicitly type the returned function and its argument
    return ({
      node,
      getPos,
      editor,
      HTMLAttributes,
    }: NodeViewRendererProps): NodeView => {
      // --- Main DOM Element (Span) ---
      const dom = document.createElement('span');

      // Apply base attributes and styles consistent with renderHTML
      dom.setAttribute('data-type', 'markdoc-info');
      dom.setAttribute('data-tag-name', 'info');
      // Using inline-block to allow positioning and clicking
      // Adding cursor-pointer to indicate interactivity
      dom.className =
        'markdoc-info-tag bg-blue-500 text-white px-2 py-1 rounded-md inline-block cursor-pointer';

      // Apply any additional HTMLAttributes passed by Tiptap
      for (const [key, value] of Object.entries(HTMLAttributes)) {
        dom.setAttribute(key, value);
      }

      // --- Helper Function to Update Display ---
      const updateDisplay = (currentNode: ProseMirrorNode) => {
        const displayPrimary = currentNode.attrs.primary || 'Info';
        // Assuming 'variable' attribute might be added later, keep the logic
        const displayVariable = currentNode.attrs.variable
          ? ` (${currentNode.attrs.variable})`
          : '';
        dom.textContent = `Info(${displayPrimary}${displayVariable})`;
        // Keep data attributes synchronized
        dom.setAttribute('data-primary', currentNode.attrs.primary || '');
        if (currentNode.attrs.variable) {
          dom.setAttribute('data-variable', currentNode.attrs.variable);
        } else {
          dom.removeAttribute('data-variable');
        }
      };

      // Initial rendering of the tag text
      updateDisplay(node);

      // --- Popover Elements (Initially Hidden) ---
      const popover = document.createElement('div');
      popover.className =
        'markdoc-info-popover absolute z-50 bg-white border border-gray-300 rounded-md shadow-lg p-2';
      // Prevent editor focus issues when interacting with the popover
      popover.contentEditable = 'false';
      // Hide initially
      popover.style.display = 'none';

      const inputLabel = document.createElement('label');
      inputLabel.textContent = 'Primary: ';
      inputLabel.className = 'text-sm font-medium text-gray-700 mr-1';

      const input = document.createElement('input');
      input.type = 'text';
      input.className =
        'text-sm border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

      popover.append(inputLabel, input);
      // Append to body to avoid positioning issues within the editor's scroll container
      document.body.appendChild(popover);

      // --- Helper: Hide Popover ---
      const hidePopover = () => {
        if (popover.style.display !== 'none') {
          popover.style.display = 'none';
        }
      };

      // --- Event Listener: Show Popover on Click ---
      dom.addEventListener('click', (event) => {
        // Prevent the click from propagating to the editor and potentially deselecting the node
        event.stopPropagation();
        event.preventDefault();

        if (!editor.isEditable) {
          return;
        }

        // Get position of the tag in the viewport
        const rect = dom.getBoundingClientRect();

        // Position popover below the tag
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`; // Add scrollY for correct positioning
        popover.style.display = 'block';

        // Populate input with current value and focus
        input.value = node.attrs.primary || '';
        input.focus();
      });

      // --- Event Listener: Update Node on Input Change ---
      input.addEventListener('input', () => {
        if (!editor.isEditable) {
          return;
        }
        const position = getPos();
        // Ensure the node position is valid
        if (typeof position !== 'number') {
          console.error('Could not get node position.');
          return;
        }

        // Update the node attribute using editor commands
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            primary: input.value,
          })
        );
        // Note: The 'update' method below will handle re-rendering the tag display
      });

      // --- Event Listener: Hide Popover on Enter/Escape in Input ---
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault(); // Prevent default form submission or line break
          hidePopover();
          // Optionally move focus back to the editor
          editor.view.focus();
        } else if (event.key === 'Escape') {
          hidePopover();
          // Optionally move focus back to the editor
          editor.view.focus();
        }
      };
      input.addEventListener('keydown', handleKeyDown);

      // --- Event Listener: Hide Popover on Outside Click ---
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target;
        // Hide if the popover is visible and the click is outside both the popover and the trigger element
        // Use `window.Node` for DOM node checks
        if (
          popover.style.display === 'block' &&
          target instanceof window.Node && // Check if target is a DOM Node
          !popover.contains(target) && // Check if click is outside the popover
          !dom.contains(target) // Check if click is outside the main DOM node (the tag)
        ) {
          hidePopover();
        }
      };
      // Use 'mousedown' to catch the click before potential focus shifts
      document.addEventListener('mousedown', handleClickOutside);

      // --- NodeView Object ---
      // This object must conform to the NodeView interface
      return {
        dom, // The main element representing the node in the editor

        // Optional: If the node itself had editable content, contentDOM would be set.
        // contentDOM: undefined,

        // Handles updates to the node from the editor state
        update: (updatedNode: ProseMirrorNode): boolean => {
          // Ensure it's the same node type (using editor.schema comparison is safer)
          if (updatedNode.type !== editor.schema.nodes[this.name]) {
            return false;
          }

          // Update the internal node reference (needed for event listeners)
          node = updatedNode;

          // Re-render the display text if attributes changed
          updateDisplay(updatedNode);

          // If the popover is currently open, update its input value
          // This handles cases where the attribute is changed externally (e.g., undo/redo)
          if (popover.style.display === 'block') {
            input.value = updatedNode.attrs.primary || '';
          }

          return true; // Indicate that the update was handled
        },

        // Cleanup when the node is destroyed
        destroy: () => {
          // Remove the popover from the DOM
          if (popover.parentNode) {
            popover.parentNode.removeChild(popover);
          }
          // Remove the global click listener
          document.removeEventListener('mousedown', handleClickOutside);
          // Remove the keydown listener from the input
          input.removeEventListener('keydown', handleKeyDown);
          // Event listeners on `dom` are automatically cleaned up when `dom` is removed.
        },

        // Prevent Tiptap from trying to handle mutations inside our popover input
        // Use ViewMutationRecord type from Tiptap/Prosemirror
        ignoreMutation: (mutation: ViewMutationRecord): boolean => {
          // Only interested in actual DOM mutations (not selection changes)
          if (mutation.type === 'selection') {
            return false;
          }
          // If the mutation target is the popover or inside it, ignore it
          // Ensure mutation.target is a DOM Node before calling contains
          // Use `window.Node` for DOM node checks
          return (
            mutation.target instanceof window.Node &&
            popover.contains(mutation.target)
          );
        },
      };
    };
  },

  // Add support for parsing from Markdown (if needed)
  // parseMarkdown: {
  //   match: node => node.type === 'text' && node.value.startsWith('{% info'),
  //   apply: (state, node, type) => {
  //     // Add parsing logic here
  //   }
  // },

  // Add support for serializing to Markdown
  // toMarkdown(state, node) {
  //   const primary = node.attrs.primary || '""';
  //   const variable = node.attrs.variable ? ` variable="${node.attrs.variable}"` : '';
  //   state.write(`{% info ${primary}${variable} /%}`);
  // }
});

export { InfoTag as default }; // Changed from MarkdocTag
