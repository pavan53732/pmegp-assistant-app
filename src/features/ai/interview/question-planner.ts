// ─── Question Planner ─────────────────────────────────────────────────────
// Determines what question to ask the user next, based on the current
// interview phase and the ProjectProfile state.
//
// Pure functions — no I/O, no AI calls, no side effects.
// See AGENT_CONTRACTS.md §12 (Question Planner contract).
// ───────────────────────────────────────────────────────────────────────────

import type { InterviewPhase } from "@/shared/types/interview";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type {
  QuestionPlan,
  PhaseConfig,
  FieldGroupConfig,
  FieldConfig,
  QuestionSuggestion,
  ChatMessage,
} from "./types";

// ── Phase Order ───────────────────────────────────────────────────────────

const PHASE_ORDER: InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
];

// ── Phase Entry Messages ──────────────────────────────────────────────────

const PHASE_ENTRY_MESSAGES: Record<InterviewPhase, string> = {
  APPLICANT_DISCOVERY:
    "Let's start with some basic details about you. This will help us determine your eligibility for PMEGP subsidy.",
  BUSINESS_DISCOVERY:
    "Great! Now tell me about the business you want to start under PMEGP.",
  ACTIVITY_RESOLUTION:
    "Now let me match your business idea with the right NIC code — this is needed for the government application form.",
  PROJECT_SIZING:
    "Let's work out the details of your project — the machinery, materials, staff, and other requirements.",
  FINANCIAL_PLANNING:
    "Let's plan the finances for your project. I'll need some numbers to prepare your project report for the bank.",
  REVIEW:
    "We've gathered all the details! Here's a summary of your project. Please review everything carefully.",
  VALIDATION_COMPLETION:
    "Almost there! Let me do a final check to make sure everything is correct before we prepare your report.",
};

// ── Helper: Resolve dot-path on an object ─────────────────────────────────

function resolveValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Helper: Check if a field is considered "filled" in the profile ────────

function isFieldFilled(profile: ProjectProfile, config: FieldConfig): boolean {
  // Check provenance first — if source is set, the field has been explicitly provided
  const prov = profile.provenance.perField[config.dotPath];
  if (prov && prov.source !== null) {
    return true;
  }

  const value = resolveValue(profile, config.dotPath);

  // Handle arrays (e.g. machinery.items, rawMaterials.items)
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  switch (config.type) {
    case "TEXT":
    case "ENUM":
    case "DATE":
      return typeof value === "string" && value.length > 0;
    case "NUMBER":
    case "CURRENCY":
      return typeof value === "number" && value > 0;
    case "BOOLEAN":
      // Booleans default to false — always treat as unfilled unless provenance confirms
      return false;
    default:
      return value !== null && value !== undefined;
  }
}

// ── Helper: Flatten all field groups into ordered list ────────────────────

function getAllFields(config: PhaseConfig): FieldConfig[] {
  return config.fieldGroups.flatMap((group: FieldGroupConfig) => group.fields);
}

// ── Phase Configurations ──────────────────────────────────────────────────

export const PHASE_CONFIGS: Record<InterviewPhase, PhaseConfig> = {
  // ── Phase 1: Applicant Discovery ────────────────────────────────────────
  APPLICANT_DISCOVERY: {
    phase: "APPLICANT_DISCOVERY",
    label: "Applicant Details",
    description:
      "Basic personal, educational, and background details of the PMEGP applicant.",
    fieldGroups: [
      {
        label: "Basic Details",
        fields: [
          {
            dotPath: "applicant.name",
            label:
              "Namaste! To get started with your PMEGP application, may I know your full name?",
            type: "TEXT",
            required: true,
            hint: "Please tell me your name as it appears on your Aadhaar card or identity proof.",
          },
          {
            dotPath: "applicant.age",
            label: "What is your age?",
            type: "NUMBER",
            required: true,
            hint: "You must be between 18 and 65 years to apply under PMEGP.",
            min: 18,
            max: 65,
          },
        ],
      },
      {
        label: "Personal Information",
        fields: [
          {
            dotPath: "applicant.gender",
            label: "May I know your gender?",
            type: "ENUM",
            required: true,
            hint: "PMEGP provides additional benefits for women entrepreneurs.",
            enumOptions: [
              { label: "Male", value: "MALE" },
              { label: "Female", value: "FEMALE" },
              { label: "Other", value: "OTHER" },
            ],
          },
          {
            dotPath: "applicant.category",
            label: "Which category do you belong to?",
            type: "ENUM",
            required: true,
            hint: "PMEGP subsidy amount depends on your category. Special categories (SC, ST, OBC, Minority, Ex-Servicemen, PH, NER) get higher subsidies — up to 35% in urban and 25% in rural areas. General category gets up to 25% in urban and 15% in rural.",
            enumOptions: [
              { label: "General", value: "GEN" },
              { label: "Scheduled Caste (SC)", value: "SC" },
              { label: "Scheduled Tribe (ST)", value: "ST" },
              { label: "Other Backward Class (OBC)", value: "OBC" },
              { label: "Minority", value: "MINORITY" },
              { label: "Ex-Servicemen", value: "EX_SERVICEMEN" },
              { label: "Person with Disability (PH)", value: "PH" },
              { label: "North Eastern Region (NER)", value: "NER" },
            ],
          },
        ],
      },
      {
        label: "Education & Entity",
        fields: [
          {
            dotPath: "applicant.education",
            label: "What is your highest educational qualification?",
            type: "ENUM",
            required: true,
            hint: "There is no minimum education requirement for PMEGP — this is just for our records.",
            enumOptions: [
              { label: "No formal education", value: "NONE" },
              { label: "Below 8th standard", value: "BELOW_8TH" },
              { label: "8th pass", value: "8TH_PASS" },
              { label: "10th pass (SSC / Matric)", value: "10TH_PASS" },
              { label: "12th pass (HSC / Intermediate)", value: "12TH_PASS" },
              { label: "Graduate (BA / BSc / BCom etc.)", value: "GRADUATE" },
              { label: "Post-Graduate (MA / MSc / MCom etc.)", value: "POST_GRADUATE" },
              { label: "Professional (Engineering / Medical / Law etc.)", value: "PROFESSIONAL" },
              { label: "Other", value: "OTHER" },
            ],
          },
          {
            dotPath: "applicant.entityType",
            label: "Under what type of entity will you set up the project?",
            type: "ENUM",
            required: true,
            hint: "Most PMEGP applicants apply as Individuals. Self-Help Groups (SHGs) are also very common in rural areas.",
            enumOptions: [
              { label: "Individual", value: "INDIVIDUAL" },
              { label: "Self-Help Group (SHG)", value: "SHG" },
              { label: "Trust", value: "TRUST" },
              { label: "Society / Institution", value: "SOCIETY" },
              { label: "Cooperative Society", value: "COOP" },
              { label: "Partnership Firm", value: "PARTNERSHIP" },
              { label: "LLP (Limited Liability Partnership)", value: "LLP" },
              { label: "Private Limited Company", value: "PRIVATE_LIMITED" },
            ],
          },
        ],
      },
      {
        label: "Background",
        fields: [
          {
            dotPath: "applicant.priorSubsidy",
            label:
              "Have you previously received any government subsidy for self-employment — like PMEGP, PMRY, REGP, or any other scheme?",
            type: "BOOLEAN",
            required: true,
            hint: "If you have already availed a government subsidy, you may not be eligible to apply again under PMEGP.",
          },
          {
            dotPath: "applicant.edpCompleted",
            label:
              "Have you completed EDP (Entrepreneurship Development Programme) training?",
            type: "BOOLEAN",
            required: true,
            hint: "EDP training is conducted by KVIC / KVIB and is required before the loan is disbursed. If you haven't done it yet, you can complete it later — don't worry.",
          },
          {
            dotPath: "applicant.experienceYears",
            label:
              "How many years of experience do you have in this type of work or business?",
            type: "NUMBER",
            required: false,
            hint: "This is optional but having experience strengthens your application. If you're starting fresh, that's perfectly fine too!",
            min: 0,
            max: 50,
          },
        ],
      },
    ],
    systemPromptAddendum:
      "You are in the APPLICANT_DISCOVERY phase. Collect the applicant's personal details ONE AT A TIME. " +
      "Be warm, respectful, and encouraging. Use simple language — many applicants may not be highly educated. " +
      "Always explain WHY you are asking each question (e.g. 'PMEGP subsidy depends on your category...'). " +
      "For ENUM fields, present the options clearly. Never ask more than one question per message.",
    canSkip: false,
  },

  // ── Phase 2: Business Discovery ─────────────────────────────────────────
  BUSINESS_DISCOVERY: {
    phase: "BUSINESS_DISCOVERY",
    label: "Business Idea",
    description:
      "Understand what business the applicant wants to start under PMEGP.",
    fieldGroups: [
      {
        label: "Business Idea",
        fields: [
          {
            dotPath: "business.name",
            label: "What would you like to name your project or unit?",
            type: "TEXT",
            required: true,
            hint: "This is the name under which your unit will be registered. For example: 'Sri Lakshmi Paper Cups Unit' or 'Ramesh Tailoring Shop'.",
          },
          {
            dotPath: "business.description",
            label:
              "Please describe the business you want to start. Tell me in your own words — what will you make or what service will you provide?",
            type: "TEXT",
            required: true,
            hint:
              "Don't worry about technical terms. Just tell me what you want to do. " +
              "For example: 'I want to make paper cups and plates' or 'I want to start a tailoring and garment making unit' or 'I want to provide computer typing and DTP services'.",
          },
        ],
      },
      {
        label: "Activity Classification",
        fields: [
          {
            dotPath: "business.activityType",
            label:
              "Based on what you've told me, would this be a manufacturing unit (making/producing goods) or a service business?",
            type: "ENUM",
            required: true,
            hint: "Manufacturing means you will produce or make goods. Service means you will provide a service to customers. This affects your subsidy rate and the maximum project cost allowed under PMEGP.",
            enumOptions: [
              {
                label: "Manufacturing (making or producing goods)",
                value: "MANUFACTURING",
              },
              { label: "Service (providing a service)", value: "SERVICE" },
            ],
          },
          {
            dotPath: "business.sector",
            label: "Which sector does your business fall under?",
            type: "ENUM",
            required: true,
            hint: "This is usually the same as your activity type. PMEGP has different project cost limits for manufacturing (up to ₹25 lakh) and service (up to ₹10 lakh) sectors.",
            enumOptions: [
              { label: "Manufacturing Sector", value: "MANUFACTURING" },
              { label: "Service Sector", value: "SERVICE" },
            ],
          },
          {
            dotPath: "business.subCategory",
            label: "What type of business activity is this exactly?",
            type: "ENUM",
            required: true,
            hint: "This helps classify your business precisely for the PMEGP application form.",
            enumOptions: [
              { label: "Manufacturing", value: "MANUFACTURING" },
              { label: "Service", value: "SERVICE" },
              { label: "Trading", value: "TRADING" },
              { label: "Transport", value: "TRANSPORT" },
            ],
          },
        ],
      },
    ],
    systemPromptAddendum:
      "You are in the BUSINESS_DISCOVERY phase. Understand what business the applicant wants to start. " +
      "Let them describe it in their OWN WORDS first — don't use technical language. " +
      "Then help classify it into the correct activity type, sector, and sub-category. " +
      "Be encouraging — this is their dream business! Explain each classification option in simple terms.",
    canSkip: false,
  },

  // ── Phase 3: Activity Resolution ────────────────────────────────────────
  ACTIVITY_RESOLUTION: {
    phase: "ACTIVITY_RESOLUTION",
    label: "Activity Classification",
    description:
      "Match the business to the correct NIC code for government classification.",
    fieldGroups: [
      {
        label: "NIC Code",
        fields: [
          {
            dotPath: "business.nicCode",
            label:
              "Let me find the correct NIC (National Industrial Classification) code for your business. Based on your description, here is what I found:",
            type: "TEXT",
            required: true,
            hint:
              "The NIC code is a government code that classifies your business type. " +
              "It is mandatory for the PMEGP application. This is determined based on your business description.",
            validationHint: "Must be a valid 5 or 6 digit NIC code.",
          },
          {
            dotPath: "business.nicDescription",
            label: "Here is the official description for this NIC code — does this match your business?",
            type: "TEXT",
            required: true,
            hint: "This is the government's official description of your business activity. Please confirm if it matches what you plan to do.",
          },
        ],
      },
    ],
    systemPromptAddendum:
      "You are in the ACTIVITY_RESOLUTION phase. The business activity needs to be matched with a NIC code. " +
      "Use the Knowledge Engine's resolveActivity function to find the best NIC code match. " +
      "Present the NIC code and its description to the user for confirmation. " +
      "If the match seems wrong, ask the user for more details and try again. " +
      "Explain what a NIC code is in simple terms — many applicants don't know about it.",
    canSkip: false,
  },

  // ── Phase 4: Project Sizing ─────────────────────────────────────────────
  PROJECT_SIZING: {
    phase: "PROJECT_SIZING",
    label: "Project Details",
    description:
      "Collect details about land, building, machinery, raw materials, employees, utilities, and production capacity.",
    fieldGroups: [
      {
        label: "Land & Building",
        fields: [
          {
            dotPath: "land.status",
            label: "What is the status of the land or premises where you will set up the unit?",
            type: "ENUM",
            required: true,
            hint: "If you own or have family land, its value can be counted as your share of the project cost. This reduces the loan amount you need.",
            enumOptions: [
              { label: "Own land", value: "OWN" },
              { label: "Family land (parents/family member)", value: "FAMILY" },
              { label: "Rented premises", value: "RENTED" },
              { label: "Leased premises", value: "LEASED" },
              { label: "Don't have land yet", value: "NONE" },
            ],
          },
          {
            dotPath: "land.areaSqFt",
            label: "What is the total area of the land or premises in square feet?",
            type: "NUMBER",
            required: false,
            hint: "Approximate area is fine. For example, 500 sq ft for a small tailoring unit or 2000 sq ft for a small manufacturing unit.",
            min: 0,
          },
          {
            dotPath: "land.buildingType",
            label: "What type of building will you use for the unit?",
            type: "ENUM",
            required: false,
            hint: "This helps estimate construction or rent costs for your project report.",
            enumOptions: [
              { label: "Own building", value: "OWN" },
              { label: "Rented building", value: "RENTED" },
              { label: "Will construct a new building / shed", value: "CONSTRUCT" },
            ],
          },
          {
            dotPath: "land.buildingAreaSqFt",
            label: "What is the covered area (built-up area under roof) in square feet?",
            type: "NUMBER",
            required: false,
            hint: "The area where machinery and work will be set up — the actual working space.",
            min: 0,
          },
          {
            dotPath: "land.constructionCost",
            label: "What is the estimated construction cost for the building or shed?",
            type: "CURRENCY",
            required: false,
            hint: "Total construction cost in rupees. If you already have a building or are renting, this can be skipped.",
            min: 0,
          },
          {
            dotPath: "land.monthlyRent",
            label: "What is the monthly rent for the premises?",
            type: "CURRENCY",
            required: false,
            hint: "Monthly rent amount in rupees. Skip this if you own the premises or have your own land.",
            min: 0,
          },
        ],
      },
      {
        label: "Location Details",
        fields: [
          {
            dotPath: "location.state",
            label: "In which state will your unit be located?",
            type: "ENUM",
            required: true,
            hint: "PMEGP subsidy rates depend on whether your unit is in a rural or urban area, and your category. State is also needed for the bank branch and KVIC/KVIB channel.",
            enumOptions: [
              { label: "Andhra Pradesh", value: "ANDHRA_PRADESH" },
              { label: "Arunachal Pradesh", value: "ARUNACHAL_PRADESH" },
              { label: "Assam", value: "ASSAM" },
              { label: "Bihar", value: "BIHAR" },
              { label: "Chhattisgarh", value: "CHHATTISGARH" },
              { label: "Delhi", value: "DELHI" },
              { label: "Goa", value: "GOA" },
              { label: "Gujarat", value: "GUJARAT" },
              { label: "Haryana", value: "HARYANA" },
              { label: "Himachal Pradesh", value: "HIMACHAL_PRADESH" },
              { label: "Jharkhand", value: "JHARKHAND" },
              { label: "Karnataka", value: "KARNATAKA" },
              { label: "Kerala", value: "KERALA" },
              { label: "Madhya Pradesh", value: "MADHYA_PRADESH" },
              { label: "Maharashtra", value: "MAHARASHTRA" },
              { label: "Manipur", value: "MANIPUR" },
              { label: "Meghalaya", value: "MEGHALAYA" },
              { label: "Mizoram", value: "MIZORAM" },
              { label: "Nagaland", value: "NAGALAND" },
              { label: "Odisha", value: "ODISHA" },
              { label: "Punjab", value: "PUNJAB" },
              { label: "Rajasthan", value: "RAJASTHAN" },
              { label: "Sikkim", value: "SIKKIM" },
              { label: "Tamil Nadu", value: "TAMIL_NADU" },
              { label: "Telangana", value: "TELANGANA" },
              { label: "Tripura", value: "TRIPURA" },
              { label: "Uttar Pradesh", value: "UTTAR_PRADESH" },
              { label: "Uttarakhand", value: "UTTARAKHAND" },
              { label: "West Bengal", value: "WEST_BENGAL" },
              { label: "Andaman & Nicobar Islands", value: "ANDAMAN_NICOBAR" },
              { label: "Chandigarh", value: "CHANDIGARH" },
              { label: "Dadra & Nagar Haveli", value: "DADRA_NAGAR_HAVELI" },
              { label: "Daman & Diu", value: "DAMAN_DIU" },
              { label: "Jammu & Kashmir", value: "JAMMU_KASHMIR" },
              { label: "Ladakh", value: "LADAKH" },
              { label: "Lakshadweep", value: "LAKSHADWEEP" },
              { label: "Puducherry", value: "PUDUCHERRY" },
            ],
          },
          {
            dotPath: "location.district",
            label: "Which district in [state] will the unit be located?",
            type: "TEXT",
            required: true,
            hint: "The district where your unit will be set up. This is needed for the application form and to determine if it falls in an aspirational district (which gets additional benefits).",
          },
          {
            dotPath: "location.area",
            label: "Will your unit be in a rural area or an urban area?",
            type: "ENUM",
            required: true,
            hint: "This is VERY IMPORTANT for your subsidy amount! Under PMEGP, rural areas get higher subsidies than urban areas. Rural = village/panchayat area (population < 20,000). Urban = municipal/town area (population >= 20,000).",
            enumOptions: [
              { label: "Rural", value: "RURAL" },
              { label: "Urban", value: "URBAN" },
            ],
          },
          {
            dotPath: "location.isHillBorderArea",
            label: "Is your unit located in a hilly area, border area, or North Eastern Region (NER)?",
            type: "BOOLEAN",
            required: true,
            hint: "Hill areas, border areas, and NER states get higher PMEGP subsidy rates. If you're in Himachal, Uttarakhand, North-East, J&K, or a border district, answer Yes.",
          },
          {
            dotPath: "location.isAspirationalDistrict",
            label: "Is the district an Aspirational District (identified by NITI Aayog)?",
            type: "BOOLEAN",
            required: false,
            hint: "Aspirational districts get priority in PMEGP processing. If you're not sure, you can say 'I don't know' and I'll check.",
          },
          {
            dotPath: "location.industrialAreaType",
            label: "What type of area will the unit be set up in?",
            type: "ENUM",
            required: false,
            hint: "This helps determine infrastructure availability and additional subsidies. Most PMEGP units are in residential or mixed-use areas.",
            enumOptions: [
              { label: "Residential / Own premises", value: "RESIDENTIAL" },
              { label: "Industrial estate / cluster", value: "INDUSTRIAL_ESTATE" },
              { label: "Commercial area / market complex", value: "COMMERCIAL" },
              { label: "Village / Panchayat land", value: "VILLAGE" },
              { label: "Other", value: "OTHER" },
            ],
          },
        ],
      },
      {
        label: "Production Capacity",
        fields: [
          {
            dotPath: "capacity.installedCapacity.unit",
            label:
              "In what unit will you measure your production? (for example: kg per month, litres per day, pieces per month)",
            type: "TEXT",
            required: true,
            hint: "How will you measure your output? Common examples: kg/month, litres/day, units/month, pieces/day, meters/month, pairs/month.",
          },
          {
            dotPath: "capacity.installedCapacity.value",
            label: "What is the maximum production capacity per that unit of time?",
            type: "NUMBER",
            required: true,
            hint: "The maximum your unit can produce. For example, if your unit is 'kg/month' and capacity is 500, it means 500 kg per month at full capacity.",
            min: 1,
          },
          {
            dotPath: "capacity.projectedCapacityUtil",
            label: "In the beginning, what percentage of your full capacity do you expect to use?",
            type: "NUMBER",
            required: false,
            hint: "Most new units start at 60-70% of capacity. It is normal to not run at full capacity initially — the number grows as your business establishes.",
            min: 10,
            max: 100,
          },
          {
            dotPath: "capacity.workingDaysPerMonth",
            label: "How many days per month will your unit operate?",
            type: "NUMBER",
            required: false,
            hint: "Typically 25 or 26 working days per month (excluding Sundays and holidays).",
            min: 1,
            max: 31,
          },
          {
            dotPath: "capacity.shifts",
            label: "How many shifts will the unit run per day?",
            type: "NUMBER",
            required: false,
            hint: "1 shift means working during the day only. 2 shifts means day and evening. Most small PMEGP units run 1 shift.",
            min: 1,
            max: 3,
          },
        ],
      },
      {
        label: "Machinery & Equipment",
        fields: [
          {
            dotPath: "machinery.items",
            label:
              "What machinery and equipment will you need for your unit? Please list them with quantities.",
            type: "TEXT",
            required: true,
            hint:
              "Tell me each machine name and how many you need. For example: " +
              "'1 Sewing machine, 1 Overlock machine, 1 Button hole machine, 1 Iron press' " +
              "or '1 Paper cup making machine, 1 Die set, 1 Auto counting machine'. " +
              "I will help you estimate the costs based on current market rates.",
          },
        ],
      },
      {
        label: "Raw Materials",
        fields: [
          {
            dotPath: "rawMaterials.items",
            label:
              "What raw materials will you need every month? Please list them with quantities.",
            type: "TEXT",
            required: true,
            hint:
              "List the main raw materials and approximately how much you'll use per month. " +
              "For example: 'Fabric cloth - 200 meters per month, Thread - 50 rolls per month, Buttons - 5000 pieces per month'. " +
              "This helps calculate your monthly working capital requirement.",
          },
        ],
      },
      {
        label: "Employees",
        fields: [
          {
            dotPath: "employees.skilled.male",
            label: "How many skilled male workers will you employ?",
            type: "NUMBER",
            required: false,
            hint: "Skilled workers have specific training or experience — like a machine operator, tailor, welder, or electrician.",
            min: 0,
          },
          {
            dotPath: "employees.skilled.female",
            label: "How many skilled female workers will you employ?",
            type: "NUMBER",
            required: false,
            hint: "PMEGP encourages women's employment — having female workers strengthens your application!",
            min: 0,
          },
          {
            dotPath: "employees.skilled.monthlyWagePerPerson",
            label: "What monthly salary will you pay to each skilled worker?",
            type: "CURRENCY",
            required: false,
            hint: "Monthly wage per skilled worker in rupees. This should be as per local market rates.",
            min: 0,
          },
          {
            dotPath: "employees.unskilled.male",
            label: "How many unskilled male helpers will you employ?",
            type: "NUMBER",
            required: false,
            hint: "Unskilled helpers do general work like loading, cleaning, packing, or assisting skilled workers.",
            min: 0,
          },
          {
            dotPath: "employees.unskilled.female",
            label: "How many unskilled female helpers will you employ?",
            type: "NUMBER",
            required: false,
            hint: "PMEGP encourages women's employment at all skill levels.",
            min: 0,
          },
          {
            dotPath: "employees.unskilled.monthlyWagePerPerson",
            label: "What monthly salary will you pay to each unskilled helper?",
            type: "CURRENCY",
            required: false,
            hint: "Monthly wage per helper in rupees.",
            min: 0,
          },
          {
            dotPath: "employees.administrative.count",
            label:
              "How many administrative staff will you need — like an accountant, supervisor, or manager?",
            type: "NUMBER",
            required: false,
            hint: "Small units often start with just 1 supervisor, or the owner manages everything directly. You can enter 0 if you will manage it yourself.",
            min: 0,
          },
          {
            dotPath: "employees.administrative.monthlyWagePerPerson",
            label: "What monthly salary will you pay to each administrative staff member?",
            type: "CURRENCY",
            required: false,
            hint: "Monthly salary in rupees for supervisor, accountant, or manager.",
            min: 0,
          },
        ],
      },
      {
        label: "Utilities & Monthly Overheads",
        fields: [
          {
            dotPath: "utilities.monthlyPowerCost",
            label: "What will be the monthly electricity bill for your unit?",
            type: "CURRENCY",
            required: false,
            hint: "Estimated monthly electricity cost in rupees. If you're not sure, I can help estimate based on your machinery.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyWaterCost",
            label: "What will be the monthly water expense?",
            type: "CURRENCY",
            required: false,
            hint: "Monthly water bill in rupees. If using a borewell, enter 0.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyRentCost",
            label:
              "What will be the monthly rent for the premises? (if different from what you told earlier)",
            type: "CURRENCY",
            required: false,
            hint: "If you already shared the rent amount earlier, you can say 'same as before' and I'll use that.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyMaintenanceCost",
            label: "What will be the monthly maintenance cost — for machinery, building, etc.?",
            type: "CURRENCY",
            required: false,
            hint: "Regular upkeep of machinery and premises in rupees per month.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyTransportCost",
            label:
              "What will be the monthly transport cost — for bringing raw materials and delivering finished goods?",
            type: "CURRENCY",
            required: false,
            hint: "Include costs for auto/rickshaw, tempo, or any vehicle used for business. In rupees per month.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyCommunicationCost",
            label: "What will be the monthly communication cost — phone, internet, etc.?",
            type: "CURRENCY",
            required: false,
            hint: "Mobile recharge, internet connection, etc. in rupees per month.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyInsuranceCost",
            label: "What will be the monthly insurance cost?",
            type: "CURRENCY",
            required: false,
            hint: "Insurance for machinery, fire, accident, etc. in rupees per month.",
            min: 0,
          },
          {
            dotPath: "utilities.monthlyMiscCost",
            label:
              "Any other monthly expenses — like stationery, tea/coffee for workers, cleaning supplies, etc.?",
            type: "CURRENCY",
            required: false,
            hint: "Small miscellaneous overheads in rupees per month.",
            min: 0,
          },
        ],
      },
    ],
    systemPromptAddendum:
      "You are in the PROJECT_SIZING phase. Collect detailed information about the project's physical setup — " +
      "land, building, machinery, raw materials, employees, and utilities. " +
      "Ask about ONE GROUP AT A TIME (e.g. all land questions together, then all machinery questions). " +
      "For machinery and raw materials, encourage the user to list what they know and offer to fill in estimated costs from the Knowledge Package. " +
      "For employees and utilities, if the user doesn't know exact numbers, offer reasonable defaults. " +
      "Use simple language and explain why each detail is needed for the project report.",
    canSkip: false,
  },

  // ── Phase 5: Financial Planning ─────────────────────────────────────────
  FINANCIAL_PLANNING: {
    phase: "FINANCIAL_PLANNING",
    label: "Financial Planning",
    description:
      "Collect financial assumptions — loan terms, revenue projections, and capital costs.",
    fieldGroups: [
      {
        label: "Loan Details",
        fields: [
          {
            dotPath: "financials.interestRate",
            label: "What interest rate has the bank quoted for your loan?",
            type: "NUMBER",
            required: true,
            hint: "PMEGP bank loans are typically at 11-14% per annum. If you don't know the exact rate, I can use the standard rate for your bank type.",
            min: 1,
            max: 30,
          },
          {
            dotPath: "financials.loanTenureYears",
            label: "How many years will the loan repayment period be?",
            type: "NUMBER",
            required: true,
            hint: "PMEGP loans are usually for 5 to 7 years. There is also a moratorium period (usually 6 months) where you only pay interest, not principal.",
            min: 3,
            max: 10,
          },
        ],
      },
      {
        label: "Revenue & Capital",
        fields: [
          {
            dotPath: "financials.projectedMonthlySales",
            label: "How much do you expect to sell per month? Please tell me the amount in rupees.",
            type: "CURRENCY",
            required: true,
            hint:
              "This is your estimated monthly income from sales. Be realistic — it's better to be slightly conservative. " +
              "For example: if you make 500 paper cups per day and sell each at ₹1.50, working 25 days, " +
              "your monthly sales would be 500 × 1.50 × 25 = ₹18,750 per month.",
            min: 0,
          },
          {
            dotPath: "financials.workingCapital",
            label: "How much working capital do you need? Please tell me the amount in rupees.",
            type: "CURRENCY",
            required: true,
            hint:
              "Working capital is the money needed for day-to-day running — buying raw materials, paying wages, rent, electricity, etc. " +
              "It is usually about 20-25% of the total project cost. If you're not sure, I can calculate it for you based on your raw materials and expenses.",
            min: 0,
          },
          {
            dotPath: "financials.otherFixedAssets",
            label:
              "Are there any other fixed assets you need — furniture, computer, printer, vehicle, etc.? Please give the total cost in rupees.",
            type: "CURRENCY",
            required: true,
            hint:
              "Any equipment or assets NOT already listed under machinery. " +
              "For example: office table-chair (₹5,000), computer with printer (₹25,000), delivery vehicle (₹1,00,000). " +
              "Give the total of all such items in rupees. If there are none, say 0.",
            min: 0,
          },
          {
            dotPath: "financials.preOperativeExpenses",
            label:
              "What are your one-time pre-operative expenses? These are costs before the unit actually starts running. Total in rupees.",
            type: "CURRENCY",
            required: true,
            hint:
              "These are one-time expenses before starting production — like MSME registration, GST registration, " +
              "trade license, electricity connection, machinery installation and trial run, " +
              "initial raw material purchase, etc. Give the total in rupees.",
            min: 0,
          },
          {
            dotPath: "financials.buildingAndCivilWorks",
            label: "What is the total cost of building, shed, or civil construction work? Total in rupees.",
            type: "CURRENCY",
            required: true,
            hint:
              "If you are constructing a new shed or building, put the total construction cost here. " +
              "If you already have a building, or are renting, this can be 0.",
            min: 0,
          },
        ],
      },
    ],
    systemPromptAddendum:
      "You are in the FINANCIAL_PLANNING phase. Collect financial details needed for the project report and bank loan application. " +
      "This is the most number-heavy section. Explain each field in SIMPLE TERMS — many applicants are not familiar with financial jargon. " +
      "Always mention amounts 'in rupees'. Help the user think through realistic numbers. " +
      "If they seem unsure about working capital or other calculations, offer to compute it for them. " +
      "Remember: total project cost = machinery + other fixed assets + pre-operative expenses + building/civil works + working capital.",
    canSkip: false,
  },

  // ── Phase 6: Review ─────────────────────────────────────────────────────
  REVIEW: {
    phase: "REVIEW",
    label: "Review & Confirmation",
    description:
      "Present a summary of all collected information for user review and confirmation.",
    fieldGroups: [],
    systemPromptAddendum:
      "You are in the REVIEW phase. Present a CLEAR, SECTION-WISE summary of all the information collected so far. " +
      "Organize it into: Applicant Details, Business Details, Project Details, and Financial Details. " +
      "Use a simple table-like format that is easy to read. " +
      "After presenting the summary, ask the user to review carefully and confirm. " +
      "If the user wants to change anything, note the corrections and update. " +
      "Be patient — this is an important step and the user should not feel rushed.",
    canSkip: true,
  },

  // ── Phase 7: Validation Completion ──────────────────────────────────────
  VALIDATION_COMPLETION: {
    phase: "VALIDATION_COMPLETION",
    label: "Final Validation",
    description: "Run final validation checks and complete the interview.",
    fieldGroups: [],
    systemPromptAddendum:
      "You are in the VALIDATION_COMPLETION phase. Run a final validation on the complete project profile. " +
      "Check for: missing mandatory fields, value inconsistencies (e.g. project cost exceeds PMEGP limits), " +
      "subsidy eligibility, and any other validation rules. " +
      "If everything is valid, congratulate the user and inform them that their project profile is complete and ready for DPR (Detailed Project Report) generation. " +
      "If there are issues, list them clearly and guide the user to fix each one.",
    canSkip: true,
  },
};

// ── 1. Question Planner ───────────────────────────────────────────────────

/**
 * Determines the next question to ask the user based on the current
 * interview phase and the profile state.
 *
 * Logic:
 *  1. Look at the current phase's field configuration.
 *  2. Check which fields are already filled (non-null in profile + provenance).
 *  3. Find the first unfilled REQUIRED field.
 *  4. Generate a natural language question for that field.
 *  5. Include suggestions for ENUM-type fields.
 *  6. Set completesPhase / isPhaseStart flags appropriately.
 */
export function planNextQuestion(
  profile: ProjectProfile,
  phase: InterviewPhase,
  conversationHistory: ChatMessage[]
): QuestionPlan {
  const config = PHASE_CONFIGS[phase];
  const allFields = getAllFields(config);

  // ── Special handling for phases with no fields (REVIEW, VALIDATION_COMPLETION)
  if (allFields.length === 0) {
    return {
      question: PHASE_ENTRY_MESSAGES[phase],
      targetFields: [],
      phase,
      isPhaseStart: true,
      completesPhase: false,
    };
  }

  // ── Find the first required field that is not yet filled
  const firstUnfilledIndex = allFields.findIndex(
    (f) => f.required && !isFieldFilled(profile, f)
  );

  // ── If all required fields are filled, look for optional unfilled fields
  if (firstUnfilledIndex === -1) {
    const firstOptionalUnfilled = allFields.find(
      (f) => !f.required && !isFieldFilled(profile, f)
    );

    if (firstOptionalUnfilled) {
      const suggestions: QuestionSuggestion[] | undefined =
        firstOptionalUnfilled.enumOptions?.map((opt) => ({
          label: opt.label,
          value: opt.value,
        }));

      return {
        question: firstOptionalUnfilled.label,
        targetFields: [firstOptionalUnfilled.dotPath],
        phase,
        hint: firstOptionalUnfilled.hint,
        suggestions,
        isPhaseStart: false,
        completesPhase: false, // Don't complete phase on first optional — ask remaining optionals first
      };
    }

    // Phase is fully complete — all fields (required + optional) are filled
    return {
      question: `All details for ${config.label} have been collected. Let's move to the next step!`,
      targetFields: [],
      phase,
      isPhaseStart: false,
      completesPhase: true,
    };
  }

  // ── Build the question plan for the first unfilled required field
  const field = allFields[firstUnfilledIndex];

  // isPhaseStart: true if no required field in this phase has been filled yet
  const hasAnyRequiredFilled = allFields.some(
    (f) => f.required && isFieldFilled(profile, f)
  );
  const isPhaseStart = !hasAnyRequiredFilled;

  // completesPhase: true if no required fields remain unfilled after this one
  const remainingRequiredUnfilled = allFields
    .slice(firstUnfilledIndex + 1)
    .filter((f) => f.required && !isFieldFilled(profile, f));
  const completesPhase = remainingRequiredUnfilled.length === 0;

  // Build suggestions for ENUM fields
  const suggestions: QuestionSuggestion[] | undefined =
    field.enumOptions?.map((opt) => ({
      label: opt.label,
      value: opt.value,
    }));

  return {
    question: field.label,
    targetFields: [field.dotPath],
    phase,
    hint: field.hint,
    suggestions,
    isPhaseStart,
    completesPhase,
  };

  // conversationHistory is accepted for future context-aware enhancements
  // (e.g., avoiding re-asking questions the user already answered in free text)
  void conversationHistory;
}

// ── 2. Phase Transition ───────────────────────────────────────────────────

/**
 * Returns the next interview phase after the current one is complete,
 * or null if we're at the final phase (VALIDATION_COMPLETION).
 */
export function getNextPhase(
  currentPhase: InterviewPhase,
  profile: ProjectProfile
): InterviewPhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return null;
  }
  // profile is accepted for potential conditional transitions in future
  void profile;
  return PHASE_ORDER[currentIndex + 1];
}

// ── 3. Phase Entry Message ────────────────────────────────────────────────

/**
 * Returns a brief intro message to display when entering a new phase.
 */
export function getPhaseEntryMessage(phase: InterviewPhase): string {
  return PHASE_ENTRY_MESSAGES[phase];
}

// ── 4. Missing Fields Helper ──────────────────────────────────────────────

/**
 * Returns which REQUIRED fields in the given phase are still missing
 * (unfilled) in the profile.
 */
export function getMissingFieldsForPhase(
  profile: ProjectProfile,
  phase: InterviewPhase
): FieldConfig[] {
  const config = PHASE_CONFIGS[phase];
  const allFields = getAllFields(config);
  return allFields.filter((f) => f.required && !isFieldFilled(profile, f));
}