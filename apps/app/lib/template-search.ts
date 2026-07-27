import Fuse from "fuse.js";

interface SearchableTemplate {
	category: string;
	title: string;
}

export const createTemplateFuse = <Template extends SearchableTemplate>(templates: Template[]) =>
	new Fuse(templates, {
		keys: ["category", "title"],
	});
