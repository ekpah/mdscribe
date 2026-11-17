import Fuse from "fuse.js";

interface SearchableTemplate {
	title: string;
}

export const createTemplateFuse = <Template extends SearchableTemplate>(templates: Template[]) =>
	new Fuse(templates, {
		keys: ["title"],
	});
