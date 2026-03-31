# Model Assets

Mount production checkpoints into `model_assets/checkpoints/`.

The API loader expects:

- `VISARA_MODEL_CHECKPOINT_PATH` to point at the checkpoint file
- `VISARA_MODEL_FACTORY_PATH` to point at the import path for the real `DualDRModel` factory or class

Example:

- `VISARA_MODEL_CHECKPOINT_PATH=./model_assets/checkpoints/visara-v3-ema.ckpt`
- `VISARA_MODEL_FACTORY_PATH=your_model_package.inference:build_dual_dr_model`
