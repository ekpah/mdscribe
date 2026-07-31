import {
	PDFButton,
	PDFCheckBox,
	PDFDropdown,
	PDFOptionList,
	PDFRadioGroup,
	PDFSignature,
	PDFTextField,
} from "pdf-lib";

export const getPdfLibFormFieldType = (field: unknown): string => {
	if (field instanceof PDFCheckBox) {
		return "PDFCheckBox";
	}
	if (field instanceof PDFDropdown) {
		return "PDFDropdown";
	}
	if (field instanceof PDFOptionList) {
		return "PDFOptionList";
	}
	if (field instanceof PDFRadioGroup) {
		return "PDFRadioGroup";
	}
	if (field instanceof PDFTextField) {
		return "PDFTextField";
	}
	if (field instanceof PDFButton) {
		return "PDFButton";
	}
	if (field instanceof PDFSignature) {
		return "PDFSignature";
	}
	return "UnknownPDFField";
};
