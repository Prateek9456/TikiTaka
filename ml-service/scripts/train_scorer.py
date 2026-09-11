"""Train and persist the XGBoost player scorer model."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engines.scorer import MODEL_PATH, generate_synthetic_training_data
import xgboost as xgb


def main() -> None:
    model = xgb.XGBRegressor(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        objective="reg:squarederror",
    )
    x_train, y_train = generate_synthetic_training_data(n_samples=2000)
    model.fit(x_train, y_train)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
