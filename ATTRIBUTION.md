# 论文与第三方素材署名

本仓库是独立的中文论文学习与教学演示材料，不是五篇论文作者发布的模型实现，也不代表作者认可本仓库的解释或实验。

## 论文原图

原图保留作者内容，用于说明对应研究方法。图号、固定版本、PDF 物理页码、原始 URL 与本地文件对应关系见 [assets/manifest.json](assets/manifest.json)。

- [RLHND: Video Foundation Models as Physically Grounded Hand Trackers for Robot Learning · 2610.09455v1](https://arxiv.org/abs/2610.09455v1)
- [Movens-Zero: Scaling Humanoid Motion Foundation Models with Large-Scale Human Videos · 2610.41877v1](https://arxiv.org/abs/2610.41877v1)
- [Ego2Robot: Scalable Robot Data Synthesis from Egocentric Human Data · 2608.02580v1](https://arxiv.org/abs/2608.02580v1)
- [Qwen-RobotManip Technical Report: Alignment Unlocks Scale for Robotic Manipulation Foundation Models · 2606.17846v2](https://arxiv.org/abs/2606.17846v2)
- [Open-HumanWAM: An Open Recipe for Scaling Human and Robot Experience for Embodied Foundation Models · 2611.06817v3](https://arxiv.org/abs/2611.06817v3)

## 作者演示视频

assets/videos/ 中的六段视频来自 [RLHND 作者项目页](https://seungjun-moon.github.io/rlhnd/)及其[官方仓库](https://github.com/seungjun-moon/rlhnd)：

- egodex1_original.mp4、egodex1_rlhnd_2d.mp4、egodex1_rlhnd_3d.mp4：输入视频与作者追踪结果。
- tactile_ot_fablab2_input.mp4、tactile_ot_fablab2_ours.mp4、tactile_ot_fablab2_force_ours.mp4：输入视频、接触结果与压力结果。

这些是作者已生成结果的回放，不是本仓库重新运行权重得到的预测。

## 接口参考

HumanWAM-Goal 桥接依据 [HumanNet 官方输入协议](https://github.com/DAGroup-PKU/HumanNet/blob/e43925f7600aab4aa9200b2e39f5674fc0d97b89/humanwam_goal/docs/inputs.md) 与同提交的 HTTP 服务实现。本仓库不包含 HumanWAM 或 RLHND 的模型权重。

## 权利范围

论文、原图、视频与相关研究结果的权利归各作者或原权利人所有。本仓库没有为第三方素材授予新的许可；进一步使用时应遵循原始来源的许可与要求。中文解读、构造数据、教学计算和展示代码为本项目整理。
