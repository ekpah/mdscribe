import Markdoc from '@markdoc/markdoc';
import type { Config } from '@markdoc/markdoc';

import React from 'react';
import type { ReactNode } from 'react';

import { markdocConfig } from "../../markdoc-config";
import { components } from '../../markdoc-config/tags/components';
import type { MarkdocComponentMap } from '../../markdoc-config/tags/components';
import { sanitizeMarkdocForRendering } from './sanitize-markdoc-for-rendering';

/**
 * Renders a Markdoc string into React elements.
 * This step uses the components defined in your Markdoc config.
 * @param {string} content - The raw Markdoc content.
 * @returns A ReactNode representing the Markdoc content.
 */
export interface RenderMarkdocReactOptions {
	/** Additional or replacement components keyed by Markdoc render name. */
	components?: MarkdocComponentMap;
	/** A complete Markdoc config. Defaults to the package config. */
	config?: Config;
	/** Disable only when the caller intentionally wants raw malformed structures. */
	sanitize?: boolean;
}

export default function renderMarkdocAsReact(
	content: string,
	options: RenderMarkdocReactOptions = {},
): ReactNode {
	const source = options.sanitize === false ? content : sanitizeMarkdocForRendering(content);
	const ast = Markdoc.parse(source);
	const note = Markdoc.transform(ast, options.config ?? markdocConfig);
	return Markdoc.renderers.react(note, React, {
		components: { ...components, ...options.components },
	});
}
