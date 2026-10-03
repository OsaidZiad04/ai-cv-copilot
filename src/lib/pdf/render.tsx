import { renderToBuffer } from "@react-pdf/renderer";
import { candidateProfileSchema, type CandidateProfile } from "../schema";
import { CvPdfDocument } from "./CvPdfDocument";

export async function renderCvPdf(input: CandidateProfile): Promise<Buffer> {
  const profile = candidateProfileSchema.parse(input);
  return renderToBuffer(<CvPdfDocument profile={profile} />);
}
