#!/usr/bin/env python3
"""Generate browser-ready curriculum data from the three book source files."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parents[1] / "data.js"
SOURCES = [
    ROOT / "work" / "upper_part_source.md",
    ROOT / "work" / "middle_part_source.md",
    ROOT / "work" / "lower_part_source.md",
]

KEYWORDS = {
    1: ["平台边界", "工作负载", "价值链"],
    2: ["用户角色", "工作负载", "平台能力"],
    3: ["Loss", "泛化", "效果指标"],
    4: ["Token", "后训练", "RAG"],
    5: ["GPU", "网络拓扑", "存储"],
    6: ["数据版本", "开发环境", "镜像"],
    7: ["训练任务", "状态机", "Checkpoint"],
    8: ["并行策略", "MFU", "扩展效率"],
    9: ["DeepSpeed", "Ray Train", "技术选型"],
    10: ["队列", "Gang Scheduling", "资源治理"],
    11: ["训练观测", "故障恢复", "有效训练"],
    12: ["实验管理", "复现", "模型资产"],
    13: ["推理服务", "端点", "容量"],
    14: ["vLLM", "Triton", "KServe"],
    15: ["Prefill", "Decode", "KV Cache"],
    16: ["SLO", "错误预算", "单位Token成本"],
    17: ["JTBD", "能力地图", "优先级"],
    18: ["领域模型", "状态机", "API"],
    19: ["多租户", "RBAC", "隔离"],
    20: ["MLOps", "血缘", "发布门禁"],
    21: ["客户画像", "切入点", "TCO"],
    22: ["MVP", "技术评审", "风险假设"],
    23: ["POC", "验收", "交付"],
    24: ["指标树", "单位经济", "贡献毛利"],
    25: ["有效利用率", "GPU经营", "资源损耗"],
    26: ["抢占", "弹性", "供需调节"],
    27: ["定价", "客户成功", "商业漏斗"],
    28: ["异构算力", "后训练", "Agent"],
    29: ["楔子产品", "护城河", "复利"],
    30: ["PAI", "百舸", "veMLP", "SageMaker"],
    31: ["综合方案", "阶段门", "可持续经营"],
}

WEEK_SPECS = [
    (1, [1, 2], "建立平台全景", "平台边界图、用户与工作负载表"),
    (2, [3, 4], "补齐模型与大模型基础", "模型训练与大模型迭代决策图"),
    (3, [5, 6], "理解基础设施与开发环境", "Infra瓶颈图、开发环境方案"),
    (4, [7, 8], "掌握训练对象与分布式原理", "训练对象模型和状态机"),
    (5, [9], "形成训练框架选型能力", "DeepSpeed、Ray等框架选型矩阵"),
    (6, [10, 11, 12], "建立训练平台运营闭环", "调度、观测、复现评审表"),
    (7, [13, 14], "建立推理服务与技术栈认知", "推理技术栈选型方案"),
    (8, [15, 16], "掌握推理性能、SLO与成本", "推理SLO、容量和成本模型"),
    (9, [17, 18], "把需求转化为平台模型", "平台能力地图和领域模型"),
    (10, [19, 20], "完善治理与MLOps", "权限治理与MLOps闭环"),
    (11, [21, 22], "完成定位与MVP方案", "市场定位和MVP方案"),
    (12, [23], "建立可验证的交付方法", "完整POC验收方案"),
    (13, [24, 25], "连接平台指标与资源利润", "指标树和GPU经营漏斗"),
    (14, [26, 27], "设计供需与商业化链路", "抢占流程、定价和客户成功方案"),
    (15, [28, 29, 30], "形成趋势与竞争判断", "趋势路线图、护城河和竞品评分卡"),
    (16, [31], "完成综合实战", "机器学习平台产品综合方案"),
]


def numbered(section: str) -> list[str]:
    return [
        re.sub(r"\s+", "", value).strip()
        for value in re.findall(r"^\d+\.\s+(.+)$", section, re.M)
    ]


def section(block: str, title: str) -> str:
    found = re.search(rf"^## {re.escape(title)}\s*$([\s\S]*?)(?=^## |^# |\Z)", block, re.M)
    return found.group(1).strip() if found else ""


def compact_practice(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]\([^\)]+\)", "", value)
    value = re.sub(r"[*_`>#]", "", value)
    return re.sub(r"\s+", "", value).strip()


def parse_chapters() -> list[dict]:
    chapters: list[dict] = []
    for source in SOURCES:
        text = source.read_text(encoding="utf-8")
        matches = list(re.finditer(r"^# 第(\d+)章 (.+)$", text, re.M))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[match.start():end]
            chapter_id = int(match.group(1))
            title = match.group(2).strip()
            meta = next((line for line in block.splitlines()[1:10] if "预计阅读时间" in line), "")
            labels = re.findall(r"`([^`]+)`", meta)
            minutes_match = re.search(r"预计阅读时间[：:]\s*(\d+)分钟", meta)
            goals = numbered(section(block, "学习目标"))[:3]
            conclusions = numbered(section(block, "本章结论"))[:5]
            practice = compact_practice(section(block, "实战作业"))
            if chapter_id <= 12:
                part, part_name = "upper", "上篇·看懂平台"
            elif chapter_id <= 23:
                part, part_name = "middle", "中篇·设计平台"
            else:
                part, part_name = "lower", "下篇·经营平台"
            chapters.append({
                "id": chapter_id,
                "part": part,
                "partName": part_name,
                "title": title,
                "labels": labels,
                "minutes": int(minutes_match.group(1)) if minutes_match else 50,
                "goals": goals,
                "conclusions": conclusions,
                "keywords": KEYWORDS[chapter_id],
                "practice": practice,
            })
    return sorted(chapters, key=lambda chapter: chapter["id"])


def question_options(chapters: list[dict], index: int, field: str, item_index: int) -> tuple[list[str], int]:
    correct = chapters[index][field][min(item_index, len(chapters[index][field]) - 1)]
    candidates = []
    for offset in (1, 5, 11, 17, 23):
        other = chapters[(index + offset) % len(chapters)]
        values = other[field]
        if values:
            choice = values[min(item_index, len(values) - 1)]
            if choice != correct and choice not in candidates:
                candidates.append(choice)
        if len(candidates) == 3:
            break
    options = candidates[:3] + [correct]
    shift = (chapters[index]["id"] + item_index * 2) % 4
    options = options[shift:] + options[:shift]
    return options, options.index(correct)


def add_quizzes(chapters: list[dict]) -> None:
    templates = [
        ("goals", 0, "以下哪项最符合本章的首要学习目标？"),
        ("conclusions", 0, "完成本章后，哪项判断最应该保留？"),
        ("goals", 2, "在产品评审中，本章要求我们重点具备哪项能力？"),
        ("conclusions", 2, "以下哪项最符合本章给出的产品方法？"),
    ]
    for index, chapter in enumerate(chapters):
        quiz = []
        for question_index, (field, item_index, prompt) in enumerate(templates, 1):
            options, answer = question_options(chapters, index, field, item_index)
            quiz.append({
                "id": f"{chapter['id']}-{question_index}",
                "prompt": prompt,
                "options": options,
                "answer": answer,
                "explanation": f"第{chapter['id']}章的核心内容明确指出：{options[answer]}",
            })
        chapter["quiz"] = quiz


def main() -> None:
    chapters = parse_chapters()
    if [chapter["id"] for chapter in chapters] != list(range(1, 32)):
        raise RuntimeError("Expected exactly chapters 1-31")
    for chapter in chapters:
        if len(chapter["goals"]) != 3 or len(chapter["conclusions"]) < 3 or not chapter["practice"]:
            raise RuntimeError(f"Chapter {chapter['id']} is incomplete")
    add_quizzes(chapters)
    weeks = [
        {"week": week, "chapterIds": ids, "goal": goal, "deliverable": deliverable,
         "part": "upper" if week <= 6 else "middle" if week <= 12 else "lower"}
        for week, ids, goal, deliverable in WEEK_SPECS
    ]
    parts = [
        {"id": "upper", "name": "看懂平台", "weeks": [1, 6], "color": "#2563eb"},
        {"id": "middle", "name": "设计平台", "weeks": [7, 12], "color": "#059669"},
        {"id": "lower", "name": "经营平台", "weeks": [13, 16], "color": "#7c3aed"},
    ]
    content = (
        "// Generated from work/*_part_source.md. Run tools/generate_data.py to refresh.\n"
        f"export const PARTS = {json.dumps(parts, ensure_ascii=False, indent=2)};\n\n"
        f"export const WEEKS = {json.dumps(weeks, ensure_ascii=False, indent=2)};\n\n"
        f"export const CHAPTERS = {json.dumps(chapters, ensure_ascii=False, indent=2)};\n"
    )
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"Generated {OUTPUT} with {len(chapters)} chapters and {sum(len(c['quiz']) for c in chapters)} questions")


if __name__ == "__main__":
    main()
