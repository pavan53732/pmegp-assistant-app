import { db } from "@/lib/db";
import type { IProjectRepository, ProjectSummary } from "./interfaces";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";

function extractSummary(project: { id: string; name: string; status: string; profileData: string; createdAt: Date; updatedAt: Date }): ProjectSummary {
  let profile: ProjectProfile | null = null;
  try { profile = JSON.parse(project.profileData) as ProjectProfile; } catch {}
  return {
    id: project.id,
    name: project.name,
    status: project.status as ProjectStatus,
    businessName: profile?.business?.name ?? "",
    businessDescription: profile?.business?.description ?? "",
    nicCode: profile?.business?.nicCode ?? null,
    totalProjectCost: profile?.financials?.totalProjectCost ?? 0,
    completeness: profile?.validation?.completeness ?? 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export class ProjectRepository implements IProjectRepository {
  async create(name: string): Promise<ProjectSummary> {
    const emptyProfile: ProjectProfile = {
      applicant: { name: "", age: 0, gender: "MALE", category: "GEN", isWomen: false, education: "NONE", entityType: "INDIVIDUAL", priorSubsidy: false, edpCompleted: false },
      business: { name: "", description: "", activityType: "MANUFACTURING", sector: "MANUFACTURING", subCategory: "MANUFACTURING" },
      location: { state: "", district: "", area: "RURAL", isHillBorderArea: false, isAspirationalDistrict: false },
      land: { status: "NONE" },
      capacity: { installedCapacity: { unit: "", value: 0 }, projectedCapacityUtil: 0, workingDaysPerMonth: 25, workingHoursPerDay: 8, shifts: 1 },
      machinery: { items: [], totalCost: 0 },
      rawMaterials: { items: [], totalMonthlyCost: 0 },
      employees: { skilled: { male: 0, female: 0, monthlyWagePerPerson: 0 }, unskilled: { male: 0, female: 0, monthlyWagePerPerson: 0 }, administrative: { count: 0, monthlyWagePerPerson: 0 }, totalMonthlyWages: 0, totalEmployment: 0 },
      utilities: { monthlyPowerCost: 0, monthlyWaterCost: 0, monthlyRentCost: 0, monthlyMaintenanceCost: 0, monthlyTransportCost: 0, monthlyCommunicationCost: 0, monthlyInsuranceCost: 0, monthlyMiscCost: 0, totalMonthlyOverheads: 0 },
      financials: { machineryAndEquipment: 0, otherFixedAssets: 0, preOperativeExpenses: 0, buildingAndCivilWorks: 0, totalFixedCapital: 0, workingCapital: 0, totalProjectCost: 0, interestRate: 0, loanTenureYears: 7, repaymentMoratoriumMonths: 6, projectedMonthlySales: 0 },
      workingCapitalDetail: { rawMaterialDays: 30, workInProgressDays: 15, finishedGoodsDays: 15, creditorsDays: 15, method: "USER_PROVIDED" },
      market: { targetMarket: "" },
      attachments: { items: [] },
      validation: { completeness: 0, missingFields: [], errors: [], contradictions: [] },
      provenance: { perField: {}, aggregate: 0 },
      completion: { currentPhase: "APPLICANT_DISCOVERY", phaseProgress: { APPLICANT_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, BUSINESS_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, ACTIVITY_RESOLUTION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, PROJECT_SIZING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, FINANCIAL_PLANNING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, REVIEW: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 }, VALIDATION_COMPLETION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 } }, startedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString(), interactionCount: 0 },
    };

    const project = await db.project.create({
      data: {
        name,
        profileData: JSON.stringify(emptyProfile),
        provenanceData: JSON.stringify(emptyProfile.provenance),
        completionData: JSON.stringify(emptyProfile.completion),
      },
    });

    return extractSummary(project);
  }

  async getById(id: string) {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return null;
    const summary = extractSummary(project);
    return { ...summary, profile: JSON.parse(project.profileData) as ProjectProfile };
  }

  async list(): Promise<ProjectSummary[]> {
    const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
    return projects.map(extractSummary);
  }

  async updateProfile(id: string, profile: ProjectProfile, status?: ProjectStatus): Promise<void> {
    const data: Record<string, unknown> = {
      profileData: JSON.stringify(profile),
      provenanceData: JSON.stringify(profile.provenance),
      completionData: JSON.stringify(profile.completion),
    };
    if (status) data.status = status;
    await db.project.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ProjectStatus): Promise<void> {
    await db.project.update({ where: { id }, data: { status } });
  }

  async delete(id: string): Promise<void> {
    await db.project.delete({ where: { id } });
  }
}

let _instance: ProjectRepository | null = null;
export function getProjectRepository(): ProjectRepository {
  if (!_instance) _instance = new ProjectRepository();
  return _instance;
}