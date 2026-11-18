# Plantify Karachi (FYP-1)

> **Hybrid Recommendation Engine for Urban Afforestation and Flora Selection in Karachi**  
> *Deterministic Rule-Based Filter + XGBoost ML Classifier*

---

## 📌 Project Overview

**Plantify Karachi** is an intelligent plant recommendation system designed specifically for the unique micro-climates, soil compositions, and environmental constraints of Karachi, Pakistan. 

The system uses a **Two-Stage Hybrid Engine**:
1. **Stage 1 (Deterministic Rule Filter):** Strictly eliminates unsuitable candidates based on safety and survival constraints (e.g., poisonous plants near children/pets, invasive species like *Conocarpus* in small spaces, root space requirements, and soil salinity limits).
2. **Stage 2 (XGBoost Probabilistic Classifier):** Calibrates and ranks surviving eligible plants using learned continuous probabilities, resolving score ties and generating the optimal **Top-6 Plant Recommendations**.

---

## 📁 Repository Structure & Documentation

All project documentation is organized in its respective directory:

```text
plantify-FYP1/
├── README.md                                          # This project overview
├── requirements.txt                                   # Python dependencies
├── train.py                                           # Model training & benchmark pipeline
├── core_info/                                         # 🧠 Academic Defense & Conceptual Foundations
│   └── ACADEMIC_DEFENSE_AND_ML_JUSTIFICATION.md      # Viva guide on 99.98% accuracy & surrogate ML
├── development_guide/                                 # 📖 Project Architecture & Roadmaps
│   ├── PROJECT_DEVELOPMENT_GUIDE.md                   # Master tracker & phase-by-phase roadmap
│   └── REAL_SALT_DATASET_V2.3_IMPLEMENTATION_PLAN.md  # ISRIC 2016 soil salinity integration specs
└── training_dataset/                                  # 📊 Datasets & Model Deliverables
    ├── training_data/                                 # Versioned Datasets
    │   ├── plantify_dataset_v2.4/                     # ⭐ Active Production Dataset (v2.4 - 2026 Salinity Projections)
    │   │   ├── README.md                              # Dataset documentation & schemas
    │   │   ├── PLANTIFY_TRAINING_PLAN.md              # Ground rules for training & preprocessing
    │   │   ├── training_clean.csv                     # 221,000 synthetic scenario rows
    │   │   ├── sites_clean.csv                        # 104 Karachi sites with 2026 projected salinity
    │   │   ├── plants_clean.csv                       # 85 verified candidate species
    │   │   └── schema.json                            # Column classifications & metadata
    │   └── plantify_dataset_v2.3/                     # 🛡️ Fallback Backup Dataset (v2.3)
    └── outputs/                                       # 📈 Versioned Output Deliverables
        ├── outputs_v2.4/                              # ⭐ Outputs for Dataset v2.4 (Active)
        │   ├── plantify_model.joblib                  # Serialized trained XGBoost model
        │   ├── feature_columns.json                   # 66-dimensional feature vector ordering
        │   ├── metrics.json                           # Quantitative test benchmarks
        │   ├── TRAINING_REPORT.md                     # Official academic evaluation report
        │   ├── confusion_matrix_xgboost.png           # Test set confusion matrix
        │   └── feature_importance_xgboost.png         # Key driving feature importances
        └── outputs_v2.3/                              # 🛡️ Outputs for Dataset v2.3 (Backup)
```

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Activate your virtual environment
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### 2. Run Model Training & Evaluation
To run the zero-leakage site-stratified training pipeline, benchmark Random Forest vs XGBoost, and regenerate evaluation reports:
```bash
python train.py
```

---

## 📊 Current Status & Roadmap

| Phase | Description | Status |
|:---|:---|:---:|
| **Phase 1** | Dataset Audit, Zero-Leakage Preprocessing & Model Benchmark | ✅ **100% Done** |
| **Phase 1.5** | Academic Reporting, Model Selection & Code Documentation | ✅ **100% Done** |
| **Phase 2** | FastAPI Backend & Two-Stage Recommendation Engine | ⏳ **Ready to Start** |
| **Phase 3** | Modern Glassmorphic Web Dashboard & Questionnaire | ⏸️ **Pending Phase 2** |
| **Phase 4** | End-to-End System Testing & FYP Viva Presentation Prep | ⏸️ **Pending Phase 3** |

*For complete phase checklists and upcoming milestones, refer to [development_guide/PROJECT_DEVELOPMENT_GUIDE.md](development_guide/PROJECT_DEVELOPMENT_GUIDE.md).*
