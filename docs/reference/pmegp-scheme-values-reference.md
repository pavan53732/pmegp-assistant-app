# PMEGP Scheme Values Reference

> Source: Old DPR-GUIDE-BLUEPRINT.md (Windows Desktop version, v1.2.1)
> These values need verification against the latest KVIC circular before
> populating the Knowledge Package JSON files.
> Status: REFERENCE ONLY — not yet authored into JSON

---

## Subsidy Matrix (Margin Money)

| Category | Urban | Rural |
|----------|-------|-------|
| General Male | 15% | 25% |
| Special Category (SC/ST/OBC/Women/PH/Ex-Serviceman/Minority/NER/Hill/Border) | 25% | 35% |

**Upgradation (existing PMEGP/REGP/MUDRA unit):**

| Category | Rate (no rural premium) |
|----------|------------------------|
| General Male | 15% |
| All Special Categories | 25% |

---

## Project Cost Ceilings

| Sector | Maximum Project Cost |
|--------|---------------------|
| Manufacturing | Rs. 50 lakhs |
| Service (including Trading & Transport sub-categories) | Rs. 25 lakhs |

---

## Own Contribution

| Category | Percentage of Project Cost |
|----------|--------------------------|
| General | 10% |
| Special Category (SC/ST/OBC/Women/PH/Ex-Serviceman/Minority/NER) | 5% |

---

## Age Rules

- Minimum: 18 years (hard rule)
- Maximum: 65 years (hard rule)

---

## Education Rules

- Projects > Rs. 10 lakhs: 8th pass required
- Projects <= Rs. 10 lakhs: No education requirement

---

## Loan Type

- **NEW** — new project under PMEGP
- **UPGRADATION** — expansion/technology upgrade of existing PMEGP/REGP/MUDRA unit

---

## EDP (Entrepreneurship Development Programme)

- Required for all NEW project beneficiaries
- Exemption for UPGRADATION cases (already trained in first round)

---

## Beneficiary Categories (for subsidy determination)

General:
- General Male

Special Category (all get higher subsidy):
- SC (Scheduled Caste)
- ST (Scheduled Tribe)
- OBC (Other Backward Class)
- Women
- PH/Disabled (Physically Handicapped)
- Ex-Serviceman
- Minority
- NER (North Eastern Region)
- Hill & Border Area residents

---

## Area Classification

- Urban
- Rural

Note: Area determines subsidy tier (Urban gets lower, Rural gets higher).
"Rural" includes: any area classified as rural by the district administration.
Hill & Border / Aspirational Districts are area-level classifications captured
separately via isRural and district profile — NOT mixed into the beneficiary
category field.

---

## Means of Finance (reconciliation identity)

```
Total Project Cost = Own Contribution + Bank Term Loan + Bank Working Capital + Subsidy (Margin Money)
```

Or equivalently:
```
Total Project Cost = Own Contribution + Bank Finance + Margin Money
where Bank Finance = Term Loan + Working Capital Loan
```

---

## Expected Subsidy Formula

```
expectedSubsidyAmount = round((bankTermLoan + bankWorkingCapital) × subsidyRate / 100)
```

Where subsidyRate comes from the subsidy matrix above (category × area).

---

## Key Financial Formulas (for Financial Engine implementation)

### EMI (Equated Monthly Instalment)
```
EMI = P × r × (1+r)^n / ((1+r)^n - 1)
where:
  P = loan principal
  r = monthly interest rate (annual rate / 12 / 100)
  n = loan tenure in months
```

### DSCR (Debt Service Coverage Ratio)
```
DSCR = Net Operating Income / Total Debt Service (annual)
where:
  Net Operating Income = Revenue - Operating Expenses - Depreciation + Depreciation (add back non-cash)
  Total Debt Service = Principal repayment + Interest payment (annual)
```
Acceptable DSCR: >= 1.5 (bankable threshold — varies by bank)

### Break-even Analysis
```
Break-even (% of capacity) = Fixed Costs / (Revenue - Variable Costs) × 100
```
Or in value terms:
```
Break-even Sales = Fixed Costs / (1 - Variable Costs / Total Sales)
```

### Working Capital Cycle
```
Working Capital (days-based) = 
  Raw Material (X days of consumption)
  + Work in Progress (Y days of cost of production)
  + Finished Goods (Z days of cost of sales)
  - Creditors (W days of purchases)
```

### Depreciation (Straight Line)
```
Annual Depreciation = (Asset Cost - Salvage Value) / Useful Life in Years
```

---

## DPR Narrative Sections (14 sections)

1. Executive Summary
2. Promoter Background
3. Business Description
4. Product/Service Details
5. Market Analysis
6. Technical Feasibility
7. Financial Projections
8. Means of Finance
9. Implementation Plan
10. Employment Generation
11. Social Impact
12. SWOT Analysis
13. Risk Assessment
14. Conclusion & Recommendation

---

## Portal Field Mapping (concept)

The KVIC online portal (kviconline.gov.in) accepts a subset of DPR fields.
Of the 14 narrative sections, only some map to portal narrative fields.
The rest are for the PDF/physical DPR only.

Portal narrative fields (subset — exact mapping TBD during portal_mapping.json authoring):
- Market & Industry Analysis (concatenation of sections 5 + parts of 4)
- Technical Details (section 6)
- Financial Summary (section 7 + 8)

---

## Entity Types Eligible

- Individual
- Self Help Group (SHG)
- Trust
- Society (registered)
- Cooperative Society
- Partnership Firm
- LLP
- Private Limited Company (production cooperative only under Service)

---

## Prior Assistance Rule

Applicants who have already availed subsidy under:
- PMEGP (earlier round)
- PMRY (Prime Minister's Rozgar Yojana — predecessor scheme)
- Any other government subsidy scheme for the same activity

are NOT eligible for a NEW project. They MAY be eligible for UPGRADATION
(if original unit was PMEGP/REGP/MUDRA and meets upgradation criteria).

---

## Notes for Knowledge Package Authoring

1. ALL values above must be verified against the LATEST KVIC circular/guidelines
   before being committed to JSON files.
2. Values change when KVIC/MoMSME issues new notifications — the Knowledge Package
   must carry effective-date and source-citation for every rule.
3. The subsidy is applied to bank finance (term loan + WC), NOT to total project cost
   in some formulations — verify the exact base from the current circular.
4. Some states have additional top-up subsidies beyond PMEGP — these are out of scope
   for v1 but the schema should not preclude adding them later.
