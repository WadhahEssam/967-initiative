// Bundled copies of the directories, used only when no database is configured (development).
// Kept apart from institutionDirectories.js, which browser components import.
import universitiesDataset from '../data/directories/universities.json' with {type:'json'};
import medicalCentersDataset from '../data/directories/medical-centers.json' with {type:'json'};
import {mapMedicalCenter,mapUniversity} from './institutionDirectories.js';
export const fallbackUniversities=universitiesDataset.records.filter(row=>row.is_published!==false).map(mapUniversity);
export const fallbackMedicalCenters=medicalCentersDataset.records.filter(row=>row.is_published!==false).map(mapMedicalCenter);
