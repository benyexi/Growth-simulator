#!/usr/bin/env python3
"""生成 3-PG 模型研究方法 Word 文档"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

doc = Document()

# ── 样式设置 ──
style = doc.styles['Normal']
style.font.name = '宋体'
style.font.size = Pt(11)
style.paragraph_format.line_spacing = 1.5

# ── 标题 ──
p = doc.add_heading('毛白杨人工林生长模拟器——3-PG 过程模型研究方法', level=1)
p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ══════════════════════════════════════════════════════════════
doc.add_heading('1  模型概述', level=2)
doc.add_paragraph(
    '本模拟器采用 3-PG（Physiological Principles Predicting Growth）过程模型'
    '（Landsberg & Waring, 1997），并参考 3-PGmix 扩展版本（Forrester & Tang, 2016）。'
    '模型以月为时间步长，基于光能利用效率理论，耦合水分平衡、营养循环和碳分配过程，'
    '模拟林分从造林到轮伐期的生物量积累和林分结构动态变化。'
)
doc.add_paragraph(
    '树种参数化以三倍体毛白杨（Populus tomentosa B301）为对象，'
    '参数来源为张萱（2023）硕士论文《基于 3-PGmix 模型的不同灌溉方式下毛白杨人工林'
    '生产力模拟及其对气候变化的响应》表 3.1 所列校准值。'
    '默认气候数据取自华北平原高唐站（36°58′N），年均温 13.2°C，年降水 563 mm。'
)

# ══════════════════════════════════════════════════════════════
doc.add_heading('2  模型核心流程', level=2)
doc.add_paragraph(
    '模型逐年循环，年内按 12 个月迭代。每月计算流程如下：'
)

steps = [
    ('落叶物候判断', '3 月（leafgrow）展叶，10 月（leaffall）落叶。'
     '无叶期（11 月–次年 2 月）仅计算简化水分平衡，跳过光合过程。'
     '展叶月叶面积按 50% 折算。越冬期间叶生物量存入叶库（WF_pool），翌年春季恢复。'),
    ('叶面积指数（LAI）计算', 'LAI = WF × SLA × 0.1，其中 WF 为叶生物量（tDM/ha），'
     'SLA 为比叶面积（m²/kg），随林龄从 SLA₀ = 12.7 衰减至 SLA₁ = 10.0。'),
    ('光截获（Beer-Lambert 定律）', 'PAR = 太阳辐射 × 0.5 × 月天数（MJ/m²/month）；'
     'fIPAR = 1 − exp(−k × LAI)，k = 0.5；APAR = PAR × fIPAR。'),
    ('环境修正因子', '综合修正 physMod = fT × fF × fN × min(fD, fθ) × fAge × fCO₂α，'
     '各因子详见第 3 节。'),
    ('总初级生产力（GPP）与净初级生产力（NPP）',
     'GPP = αc × physMod × APAR × 1.104（单位转换系数：4.6 molPAR/MJ × 12 gC/mol '
     '× 2 gDM/gC × 0.01 ha 转换），NPP = GPP × Y，Y = 0.47。'),
    ('碳分配', 'NPP 按比例分配至叶（ηF）、干（ηS）、根（ηR）。'
     '根分配比 ηR = pRx·pRn / [pRn + (pRx − pRn) × m·φ]，'
     '其中 φ = min(fD, fθ)，m = m₀ + (1 − m₀) × FR。'
     '叶干分配比 pFS 随 DBH 变化：pFS = pFS₂ × (DBH/2)^[ln(pFS₂₀/pFS₂)/ln(10)]。'),
    ('凋落与周转', '叶凋落量 = γF × WF，根周转量 = γR × WR。'
     'γF 随林龄从 γF₀ = 0.001 增至 γF₁ = 0.027（月⁻¹），γR = 0.02（月⁻¹）。'),
    ('水分平衡', '净降水 = 降水 − 冠层截留（MaxIntcptn × 冠层覆盖度 × 降水）；'
     '冠层蒸腾由 Penman-Monteith 方程计算（详见第 4 节）；'
     '土壤蒸发 = 平衡蒸发 × 0.5 × (1 − 冠层覆盖度)；'
     'ASW = ASW + 净降水 + 灌溉 − 蒸腾 − 土壤蒸发，受 [0, maxASW] 约束。'),
    ('自疏（3/2 幂法则）', '当平均单株干生物量超过阈值 wSx = wSx₁₀₀₀ × (1000/N)^1.5 时，'
     '降低密度 N 使其回到自疏线以下。wSx₁₀₀₀ = 300 kg。'),
    ('年末反算林分结构', 'DBH = (WS×1000/N / aWS)^(1/nWS)；'
     'H = aH × DBH^nHB × N^nHC；V = aV × DBH^nVB × H^nVH × N。'),
]

for i, (title, desc) in enumerate(steps, 1):
    p = doc.add_paragraph()
    run = p.add_run(f'（{i}）{title}：')
    run.bold = True
    p.add_run(desc)

# ══════════════════════════════════════════════════════════════
doc.add_heading('3  环境修正因子', level=2)

doc.add_paragraph('所有修正因子取值范围为 [0, 1]（fCO₂α 除外，可 > 1）。')

modifiers = [
    ('温度修正 fT', '论文公式 3-4',
     'fT = [(Tav − Tmin)/(Topt − Tmin)] × [(Tmax − Tav)/(Tmax − Topt)]^[(Tmax−Topt)/(Topt−Tmin)]',
     'Tmin = 5°C（光合最低温），Topt = 20°C（最适温），Tmax = 40°C（最高温），Tav = (Tmax_月 + Tmin_月)/2。'),
    ('霜冻修正 fF', '论文公式 3-5',
     'fF = max(0, 1 − kF × nFrostDays/30)',
     'kF = 1.0。霜冻天数由月最低温估算：Tmin < −9 → 30 天；−9 ≤ Tmin < 0 → −2Tmin + 11.6；Tmin ≥ 0 → 0。'),
    ('肥力修正 fN', '论文公式 3-6',
     'fN = 1 − (1 − fN₀) × (1 − FR)^nfN',
     'fN₀ = 0.5，nfN = 1.0，FR 为用户输入的土壤肥力等级（0–1）。'),
    ('林龄修正 fAge', '论文公式 3-7',
     'fAge = 1 / [1 + (relAge/rAge)^nAge]',
     'relAge = 林龄/maxAge，maxAge = 50 年，rAge = 0.95，nAge = 4。'),
    ('VPD 修正 fD', '论文公式 3-8',
     'fD = exp(−kD × VPD)',
     'kD = 0.05 kPa⁻¹。VPD ≈ eSat(Tav) − eSat(Tmin)，eSat(T) = 0.6108 × exp(17.27T/(T+237.3))。'),
    ('土壤水分修正 fθ', '论文公式 3-9',
     'fθ = 1 / [1 + ((1 − ASW/maxASW)/cθ)^nθ]',
     'cθ = 0.6，nθ = 7。ASW 为当前有效土壤水（mm），maxASW 为最大有效土壤水。'),
    ('CO₂ 光合修正 fCO₂α', '论文公式 3-10',
     'fCO₂α = fCα700 × Ca / [350 × (fCα700 − 1) + Ca]',
     'fCα700 = 1.4，Ca 为大气 CO₂ 浓度（ppm），参考浓度 350 ppm。'),
    ('CO₂ 导度修正 fCO₂g', 'Sands 2004 公式 7',
     'fCO₂g = fCg700 / [2fCg700 − 1 + (1 − fCg700) × Ca/350]',
     'fCg700 = 0.7。'),
]

for name, source, formula, params in modifiers:
    p = doc.add_paragraph()
    run = p.add_run(f'{name}（{source}）')
    run.bold = True
    p = doc.add_paragraph(f'  公式：{formula}')
    p = doc.add_paragraph(f'  参数：{params}')

# ══════════════════════════════════════════════════════════════
doc.add_heading('4  Penman-Monteith 蒸腾模型', level=2)
doc.add_paragraph(
    '月蒸腾量采用 Penman-Monteith 方程计算：'
)
doc.add_paragraph(
    '  E = [Δ × Rn + ρcp × VPD × ga] / [λ × (Δ + γ × (1 + ga/gc))]'
)
doc.add_paragraph(
    '其中：Rn = 太阳辐射 × 0.7 × 10⁶/86400（W/m²，净辐射近似）；'
    'Δ = 4098 × eSat(Tav) / (Tav + 237.3)²（Pa/K，饱和水汽压曲线斜率）；'
    'λ = 2.46×10⁶ J/kg（蒸发潜热）；γ = 66 Pa/K（干湿表常数）；'
    'ρcp = 1221 J/(m³·K)；ga = 0.2 m/s（边界层导度）。'
)
doc.add_paragraph(
    '冠层导度：gc = MaxCond × fAge × fT × min(fD, fθ) × fCO₂g × min(1, LAI/LAIgcx)，'
    '其中 MaxCond = 0.02 m/s，LAIgcx = 3.5。'
)

# ══════════════════════════════════════════════════════════════
doc.add_heading('5  树种生理参数', level=2)
doc.add_paragraph('以下参数来自张萱（2023）硕士论文表 3.1，树种为三倍体毛白杨 B301。')

# 参数表
table_data = [
    ('参数', '符号', '值', '单位', '说明'),
    ('叶干分配比 @DBH=2cm', 'pFS2', '0.1', '—', ''),
    ('叶干分配比 @DBH=20cm', 'pFS20', '0.053', '—', ''),
    ('干生物量常数', 'aWS', '0.0319', 'kg', 'WS = aWS × D^nWS'),
    ('干生物量幂指数', 'nWS', '2.8303', '—', ''),
    ('NPP→根 最大分配比', 'pRx', '0.37', '—', ''),
    ('NPP→根 最小分配比', 'pRn', '0.16', '—', ''),
    ('叶最大凋落率', 'γF1', '0.027', 'month⁻¹', ''),
    ('叶初始凋落率', 'γF0', '0.001', 'month⁻¹', ''),
    ('叶凋落中值林龄', 'tγF', '12', 'months', ''),
    ('根月周转率', 'γR', '0.02', 'month⁻¹', ''),
    ('展叶月', 'leafgrow', '3', '月', '3月展叶'),
    ('落叶月', 'leaffall', '10', '月', '10月落叶'),
    ('光合最低温', 'Tmin', '5', '°C', ''),
    ('光合最适温', 'Topt', '20', '°C', ''),
    ('光合最高温', 'Tmax', '40', '°C', ''),
    ('幼龄比叶面积', 'SLA0', '12.7', 'm²/kg', ''),
    ('成熟比叶面积', 'SLA1', '10.0', 'm²/kg', ''),
    ('冠层量子效率', 'αCx', '0.07', 'molC/molPAR', ''),
    ('消光系数', 'k', '0.5', '—', 'Beer-Lambert'),
    ('最大冠层导度', 'MaxCond', '0.02', 'm/s', ''),
    ('最大导度对应LAI', 'LAIgcx', '3.5', 'm²/m²', ''),
    ('树高常数', 'aH', '0.9706', '—', 'H = aH × D^nHB × N^nHC'),
    ('树高-DBH 幂', 'nHB', '1.0216', '—', ''),
    ('树高-密度 幂', 'nHC', '0', '—', ''),
    ('材积常数', 'aV', '0.000085', '—', 'V = aV × D^nVB × H^nVH'),
    ('材积-DBH 幂', 'nVB', '1.742', '—', ''),
    ('材积-H 幂', 'nVH', '0.8534', '—', ''),
    ('幼龄木材密度', 'ρmin', '0.354', 't/m³', ''),
    ('成熟木材密度', 'ρmax', '0.354', 't/m³', ''),
]

table = doc.add_table(rows=len(table_data), cols=5)
table.style = 'Table Grid'
table.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, row_data in enumerate(table_data):
    for j, cell_text in enumerate(row_data):
        cell = table.cell(i, j)
        cell.text = cell_text
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.space_before = Pt(0)
            for run in paragraph.runs:
                run.font.size = Pt(9)
                if i == 0:
                    run.bold = True

# ══════════════════════════════════════════════════════════════
doc.add_heading('6  模型默认参数', level=2)
doc.add_paragraph('以下参数论文未明确列出，采用 3-PG 标准默认值（Sands, 2010）。')

defaults_data = [
    ('参数', '符号', '值', '说明'),
    ('NPP/GPP 碳利用效率', 'Y', '0.47', ''),
    ('霜冻系数', 'kF', '1.0', ''),
    ('VPD 响应系数', 'kD', '0.05 kPa⁻¹', ''),
    ('FR=0 肥力因子值', 'fN0', '0.5', ''),
    ('自疏最大单株生物量', 'wSx1000', '300 kg', '@1000株/ha'),
    ('自疏幂', 'thinPower', '1.5', '3/2 法则'),
    ('最大降雨截留率', 'MaxIntcptn', '0.15', ''),
    ('边界层导度', 'BLcond', '0.2 m/s', ''),
    ('林龄影响指数', 'nAge', '4', ''),
    ('fAge=0.5 相对林龄', 'rAge', '0.95', ''),
    ('最大生理寿命', 'maxAge', '50 年', ''),
    ('CO₂=700 光合增效', 'fCα700', '1.4', ''),
    ('CO₂=700 导度降低', 'fCg700', '0.7', ''),
    ('50%缺水相对含水量', 'cθ', '0.6', '砂壤土'),
    ('水分影响指数', 'nθ', '7', ''),
    ('叶初始生物量', 'WF_init', '0.01 tDM/ha', '1年生根萌苗'),
    ('干初始生物量', 'WS_init', '0.01 tDM/ha', ''),
    ('根初始生物量', 'WR_init', '0.01 tDM/ha', ''),
]

table2 = doc.add_table(rows=len(defaults_data), cols=4)
table2.style = 'Table Grid'
table2.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, row_data in enumerate(defaults_data):
    for j, cell_text in enumerate(row_data):
        cell = table2.cell(i, j)
        cell.text = cell_text
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.space_before = Pt(0)
            for run in paragraph.runs:
                run.font.size = Pt(9)
                if i == 0:
                    run.bold = True

# ══════════════════════════════════════════════════════════════
doc.add_heading('7  默认气候数据', level=2)
doc.add_paragraph('华北平原高唐站（36°58′N）典型月气候数据，年均温 13.2°C，年降水 563 mm（论文 2.1 节）。')

clim_data = [
    ('月份', '最高温 °C', '最低温 °C', '降水 mm', '辐射 MJ/m²/d', '雨日 d'),
    ('1',  '2',  '-8', '5',   '8.5',  '2'),
    ('2',  '6',  '-4', '8',   '10.5', '3'),
    ('3',  '13', '1',  '15',  '14.0', '4'),
    ('4',  '21', '8',  '25',  '18.0', '5'),
    ('5',  '27', '14', '35',  '21.0', '6'),
    ('6',  '32', '20', '65',  '22.0', '8'),
    ('7',  '32', '23', '180', '19.0', '13'),
    ('8',  '31', '22', '140', '18.0', '11'),
    ('9',  '27', '15', '50',  '15.5', '7'),
    ('10', '20', '8',  '25',  '12.5', '5'),
    ('11', '11', '0',  '12',  '9.0',  '3'),
    ('12', '4',  '-6', '5',   '7.5',  '2'),
]

table3 = doc.add_table(rows=len(clim_data), cols=6)
table3.style = 'Table Grid'
table3.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, row_data in enumerate(clim_data):
    for j, cell_text in enumerate(row_data):
        cell = table3.cell(i, j)
        cell.text = cell_text
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.space_before = Pt(0)
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.font.size = Pt(9)
                if i == 0:
                    run.bold = True

# ══════════════════════════════════════════════════════════════
doc.add_heading('8  经营情景预设', level=2)
doc.add_paragraph(
    '模拟器提供两种经营情景：\n'
    '（1）纸浆林（短轮伐）：初植密度 1666 株/ha，轮伐期 5 年，FR = 0.7；\n'
    '（2）锯材林（长轮伐）：初植密度 833 株/ha，轮伐期 20 年，FR = 0.6。\n'
    '用户可自定义密度、轮伐期、间伐方案、肥力、CO₂ 浓度、灌溉量和气候数据。'
)

# ══════════════════════════════════════════════════════════════
doc.add_heading('9  参考文献', level=2)
refs = [
    'Landsberg J J, Waring R H. A generalised model of forest productivity using simplified concepts of radiation-use efficiency, carbon balance and partitioning[J]. Forest Ecology and Management, 1997, 95(3): 209-228.',
    'Forrester D I, Tang X. Analysing the spatial and temporal dynamics of species interactions in mixed-species forests and the effects of stand density using the 3-PG model[J]. Ecological Modelling, 2016, 319: 233-254.',
    'Sands P J. 3PGpjs user manual[R]. 2004.',
    'Sands P J. 3PGpjs - a user-friendly interface to 3-PG, the Landsberg and Waring model of forest productivity[R]. Technical Report 29, CRC for Sustainable Production Forestry, 2010.',
    '张萱. 基于 3-PGmix 模型的不同灌溉方式下毛白杨人工林生产力模拟及其对气候变化的响应[D]. 北京林业大学, 2023.',
]
for ref in refs:
    p = doc.add_paragraph(ref)
    p.paragraph_format.first_line_indent = Cm(-0.7)
    p.paragraph_format.left_indent = Cm(0.7)
    p.style.font.size = Pt(10)

# ── 保存 ──
output_path = '/home/user/Growth-simulator/3PG模型研究方法.docx'
doc.save(output_path)
print(f'文档已保存至: {output_path}')
