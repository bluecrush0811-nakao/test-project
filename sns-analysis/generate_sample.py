"""X / Threads のSNS分析用スプレッドシート(サンプルデータ入り)を生成するスクリプト。

使い方:
    python sns-analysis/generate_sample.py
    -> sns-analysis/sns_analysis.xlsx が作成されます。
サンプルデータはダミーです。実データは「投稿データ」「フォロワー推移」シートの
青字の列に貼り付けてください(集計・グラフは自動で更新されます)。
"""
import datetime as dt
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.comments import Comment
from openpyxl.formatting.rule import DataBarRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).with_name("sns_analysis.xlsx")
FONT = "Arial"
LAST_ROW = 500  # 投稿データの入力可能な最終行
SNS_LIST = ["X", "Threads"]
TYPES = ["テキスト", "画像", "動画", "リンク"]
WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"]
SLOTS = ["朝(6-10時)", "昼(11-14時)", "夕方(15-18時)", "夜(19-23時)", "深夜(0-5時)"]

BLUE = Font(name=FONT, color="0000FF")
BLACK = Font(name=FONT)
BOLD = Font(name=FONT, bold=True)
HEAD = Font(name=FONT, bold=True, color="FFFFFF")
TITLE = Font(name=FONT, bold=True, size=14)
HEAD_FILL = PatternFill("solid", fgColor="1F3A5F")
SUB_FILL = PatternFill("solid", fgColor="DCE6F1")
INPUT_FILL = PatternFill("solid", fgColor="FFFF00")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center")


def header(ws, row, labels, col=1):
    for i, label in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=label)
        c.font, c.fill, c.alignment, c.border = HEAD, HEAD_FILL, CENTER, BOX


# ---------------------------------------------------------------- sample data
def make_posts(rng):
    """ダミー投稿データ。X は動画・画像/夜が強く、Threads はテキスト/返信が伸びる傾向を持たせる。"""
    type_boost = {
        "X": {"テキスト": 0.8, "画像": 1.3, "動画": 1.6, "リンク": 0.6},
        "Threads": {"テキスト": 1.5, "画像": 1.1, "動画": 0.9, "リンク": 0.5},
    }
    hour_boost = lambda h: 1.4 if 19 <= h <= 22 else 1.1 if 12 <= h <= 13 else 0.8 if h < 6 else 1.0
    topics = ["新商品の紹介", "開発の裏話", "よくある質問への回答", "イベント告知", "ユーザーの声",
              "業界ニュースへのコメント", "今日のひとこと", "ノウハウ共有", "アンケート", "ブログ更新のお知らせ"]
    posts = []
    day = dt.date(2026, 7, 1)
    while day <= dt.date(2026, 8, 31):
        for sns, prob in (("X", 0.95), ("Threads", 0.7)):
            if rng.random() > prob:
                continue
            ptype = rng.choices(TYPES, weights=[4, 3, 2, 1])[0]
            hour = rng.choice([7, 8, 9, 12, 13, 17, 18, 20, 21, 22, 23, 1])
            base_imp = 1800 if sns == "X" else 900
            growth = 1 + (day - dt.date(2026, 7, 1)).days / 120
            weekend = 1.15 if day.weekday() >= 5 else 1.0
            boost = type_boost[sns][ptype] * hour_boost(hour) * weekend
            imp = int(base_imp * growth * rng.uniform(0.5, 1.6) * (0.7 + 0.3 * boost))
            er = (0.018 if sns == "X" else 0.035) * boost * rng.uniform(0.6, 1.4)
            eng = imp * er
            likes = int(eng * 0.62)
            reposts = int(eng * (0.14 if sns == "X" else 0.08))
            replies = int(eng * (0.09 if sns == "X" else 0.22))
            quotes = int(eng * 0.04)
            clicks = int(eng * rng.uniform(0.3, 0.6)) if (sns == "X" and ptype == "リンク") else (
                int(eng * 0.05) if sns == "X" else 0)
            posts.append([day, dt.time(hour, rng.choice([0, 15, 30, 45])), sns, ptype,
                          rng.choice(topics), imp, likes, reposts, replies, quotes, clicks])
        day += dt.timedelta(days=1)
    return posts


def make_followers(rng):
    rows, x, th = [], 3200, 850
    day = dt.date(2026, 6, 28)
    while day <= dt.date(2026, 8, 30):
        rows.append([day, x, th])
        x += rng.randint(40, 110)
        th += rng.randint(30, 90)
        day += dt.timedelta(days=7)
    return rows


# ---------------------------------------------------------------- sheets
def build_guide(wb):
    ws = wb.active
    ws.title = "使い方"
    lines = [
        ("SNS分析シート(X / Threads)", TITLE),
        ("", None),
        ("※ 現在入っているデータはすべてダミー(サンプル)です。実データに差し替えてご利用ください。", Font(name=FONT, bold=True, color="C00000")),
        ("", None),
        ("■ シート構成", BOLD),
        ("・投稿データ … 1投稿 = 1行。青字の列(A〜K)を入力します。黒字の列(L〜P)は自動計算です。", BLACK),
        ("・フォロワー推移 … 週1回などの定点で、各SNSのフォロワー数を青字の列に入力します。", BLACK),
        ("・サマリー … SNS別KPI、投稿タイプ別・曜日別・時間帯別のエンゲージメント率、TOP5投稿を自動集計します。", BLACK),
        ("", None),
        ("■ 色のルール", BOLD),
        ("・青字 = 手入力するセル / 黒字 = 計算式(触らない)", BLACK),
        ("", None),
        ("■ 実データへの差し替え手順", BOLD),
        ("1. 「投稿データ」シートのA2:K行のサンプルを削除します(L〜P列の計算式は残してください)。", BLACK),
        ("2. X: アナリティクス画面から投稿のCSVをエクスポートし、インプレッション・いいね・リポスト・返信・引用・リンククリックを該当列に貼り付けます。", BLACK),
        ("3. Threads: インサイト画面の投稿ごとの数値(閲覧数・いいね・返信・再投稿・引用)を貼り付けます。リンククリックは取得できないため 0 で構いません。", BLACK),
        (f"4. SNS列は「X」または「Threads」、投稿タイプは「{' / '.join(TYPES)}」のいずれかを選択します(プルダウンあり)。", BLACK),
        (f"5. 入力できるのは {LAST_ROW} 行目までです。", BLACK),
        ("", None),
        ("■ 指標の定義", BOLD),
        ("・エンゲージメント合計 = いいね + リポスト + 返信 + 引用 + リンククリック", BLACK),
        ("・エンゲージメント率 = エンゲージメント合計 ÷ インプレッション", BLACK),
        ("・サマリーのエンゲージメント率は「合計エンゲージメント ÷ 合計インプレッション」(インプレッションで加重した率)です。", BLACK),
        ("", None),
        ("■ 入力例(1行分)", BOLD),
    ]
    for i, (text, font) in enumerate(lines, start=1):
        c = ws.cell(row=i, column=1, value=text)
        if font:
            c.font = font
    r = len(lines) + 1
    labels = ["投稿日", "時刻", "SNS", "投稿タイプ", "内容メモ", "インプレッション", "いいね", "リポスト", "返信", "引用", "リンククリック"]
    header(ws, r, labels)
    example = [dt.date(2026, 9, 1), dt.time(21, 0), "X", "画像", "新商品の紹介", 2400, 38, 9, 4, 1, 3]
    for j, v in enumerate(example, start=1):
        c = ws.cell(row=r + 1, column=j, value=v)
        c.font, c.border = BLUE, BOX
    ws.cell(row=r + 1, column=1).number_format = "yyyy/mm/dd"
    ws.cell(row=r + 1, column=2).number_format = "hh:mm"
    ws.column_dimensions["A"].width = 14
    for col in "BCDEFGHIJK":
        ws.column_dimensions[col].width = 13


def build_posts(wb, posts):
    ws = wb.create_sheet("投稿データ")
    labels = ["投稿日", "時刻", "SNS", "投稿タイプ", "内容メモ", "インプレッション", "いいね", "リポスト",
              "返信", "引用", "リンククリック", "エンゲージメント合計", "エンゲージメント率", "曜日", "時間帯", "順位用(自動)"]
    header(ws, 1, labels)
    for i, p in enumerate(posts, start=2):
        for j, v in enumerate(p, start=1):
            ws.cell(row=i, column=j, value=v)
    for r in range(2, LAST_ROW + 1):
        ws[f"L{r}"] = f'=IF(A{r}="","",SUM(G{r}:K{r}))'
        ws[f"M{r}"] = f'=IF(A{r}="","",IF(F{r}=0,0,L{r}/F{r}))'
        ws[f"N{r}"] = f'=IF(A{r}="","",CHOOSE(WEEKDAY(A{r},2),"月","火","水","木","金","土","日"))'
        ws[f"O{r}"] = (f'=IF(B{r}="","",IF(HOUR(B{r})<6,"{SLOTS[4]}",IF(HOUR(B{r})<11,"{SLOTS[0]}",'
                       f'IF(HOUR(B{r})<15,"{SLOTS[1]}",IF(HOUR(B{r})<19,"{SLOTS[2]}","{SLOTS[3]}")))))')
        # 同率の投稿を区別するため行番号でごく小さな差をつける
        ws[f"P{r}"] = f'=IF(M{r}="","",M{r}+ROW()/1000000000)'
        for col in "ABCDEFGHIJK":
            ws[f"{col}{r}"].font = BLUE
        for col in "LMNOP":
            ws[f"{col}{r}"].font = BLACK
        ws[f"P{r}"].font = Font(name=FONT, color="A6A6A6")
        ws[f"A{r}"].number_format = "yyyy/mm/dd"
        ws[f"B{r}"].number_format = "hh:mm"
        for col in "FGHIJKL":
            ws[f"{col}{r}"].number_format = "#,##0"
        ws[f"M{r}"].number_format = "0.00%"
        ws[f"P{r}"].number_format = "0.0000%"
    ws["P1"].comment = Comment("TOP5抽出用の補助列です(エンゲージメント率+同率回避用の微小値)。編集不要。", "SNS分析")

    dv_sns = DataValidation(type="list", formula1='"X,Threads"', allow_blank=True)
    dv_type = DataValidation(type="list", formula1=f'"{",".join(TYPES)}"', allow_blank=True)
    ws.add_data_validation(dv_sns)
    ws.add_data_validation(dv_type)
    dv_sns.add(f"C2:C{LAST_ROW}")
    dv_type.add(f"D2:D{LAST_ROW}")
    ws.conditional_formatting.add(f"M2:M{LAST_ROW}", DataBarRule(start_type="min", end_type="max", color="5B9BD5"))

    widths = [12, 8, 10, 11, 24, 15, 9, 9, 9, 9, 13, 18, 17, 7, 14, 13]
    for j, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=j).column_letter].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:P{LAST_ROW}"


def build_followers(wb, rows):
    ws = wb.create_sheet("フォロワー推移")
    header(ws, 1, ["日付", "X フォロワー", "Threads フォロワー", "X 増減", "Threads 増減"])
    for i, row in enumerate(rows, start=2):
        for j, v in enumerate(row, start=1):
            c = ws.cell(row=i, column=j, value=v)
            c.font = BLUE
        ws.cell(row=i, column=1).number_format = "yyyy/mm/dd"
        ws.cell(row=i, column=2).number_format = "#,##0"
        ws.cell(row=i, column=3).number_format = "#,##0"
        if i > 2:
            ws[f"D{i}"] = f"=B{i}-B{i-1}"
            ws[f"E{i}"] = f"=C{i}-C{i-1}"
        else:
            ws[f"D{i}"] = "-"
            ws[f"E{i}"] = "-"
        for col in "DE":
            ws[f"{col}{i}"].font = BLACK
            ws[f"{col}{i}"].number_format = "+#,##0;-#,##0;0"
            ws[f"{col}{i}"].alignment = Alignment(horizontal="right")
    n = len(rows) + 1
    for col, w in zip("ABCDE", [12, 14, 18, 10, 14]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"

    chart = LineChart()
    chart.title = "フォロワー推移"
    chart.y_axis.title = "フォロワー数"
    chart.height, chart.width = 8, 18
    chart.add_data(Reference(ws, min_col=2, max_col=3, min_row=1, max_row=n), titles_from_data=True)
    chart.set_categories(Reference(ws, min_col=1, min_row=2, max_row=n))
    chart.x_axis.number_format = "mm/dd"
    ws.add_chart(chart, "G2")
    return n


def build_summary(wb, follower_last_row):
    ws = wb.create_sheet("サマリー", 1)
    P = "投稿データ"
    rng = lambda col: f"{P}!${col}$2:${col}${LAST_ROW}"
    SNS, TYP, IMP, ENG, ER, WD, SLOT, RANK = (rng(c) for c in "CDFLMNOP")

    ws["A1"] = "SNS分析サマリー(X / Threads)"
    ws["A1"].font = TITLE
    ws["A2"] = f'="対象期間: "&TEXT(MIN({rng("A")}),"yyyy/mm/dd")&" 〜 "&TEXT(MAX({rng("A")}),"yyyy/mm/dd")'
    ws["A2"].font = BLACK

    # --- 1. KPI
    ws["A4"] = "1. SNS別 主要KPI"
    ws["A4"].font = BOLD
    header(ws, 5, ["指標", "X", "Threads"])
    kpis = [
        ("投稿数", lambda s: f'=COUNTIFS({SNS},"{s}")', "#,##0"),
        ("合計インプレッション", lambda s: f'=SUMIFS({IMP},{SNS},"{s}")', "#,##0"),
        ("1投稿あたり平均インプレッション", lambda s: f'=IF(COUNTIFS({SNS},"{s}")=0,0,SUMIFS({IMP},{SNS},"{s}")/COUNTIFS({SNS},"{s}"))', "#,##0"),
        ("合計エンゲージメント", lambda s: f'=SUMIFS({ENG},{SNS},"{s}")', "#,##0"),
        ("エンゲージメント率", lambda s: f'=IF(SUMIFS({IMP},{SNS},"{s}")=0,0,SUMIFS({ENG},{SNS},"{s}")/SUMIFS({IMP},{SNS},"{s}"))', "0.00%"),
        ("合計いいね", lambda s: f'=SUMIFS({rng("G")},{SNS},"{s}")', "#,##0"),
        ("合計リポスト", lambda s: f'=SUMIFS({rng("H")},{SNS},"{s}")', "#,##0"),
        ("合計返信", lambda s: f'=SUMIFS({rng("I")},{SNS},"{s}")', "#,##0"),
        ("合計リンククリック", lambda s: f'=SUMIFS({rng("K")},{SNS},"{s}")', "#,##0"),
    ]
    r = 6
    for label, f, fmt in kpis:
        ws.cell(row=r, column=1, value=label)
        for j, s in enumerate(SNS_LIST, start=2):
            c = ws.cell(row=r, column=j, value=f(s))
            c.number_format = fmt
        r += 1
    FL = f"フォロワー推移"
    ws.cell(row=r, column=1, value="最新フォロワー数")
    ws.cell(row=r + 1, column=1, value="期間中のフォロワー増加")
    for j, col in ((2, "B"), (3, "C")):
        last = f"INDEX({FL}!${col}$2:${col}$500,COUNT({FL}!$A$2:$A$500))"
        c = ws.cell(row=r, column=j, value=f"={last}")
        c.number_format, c.font = "#,##0", Font(name=FONT, color="008000")
        c = ws.cell(row=r + 1, column=j, value=f"={last}-{FL}!${col}$2")
        c.number_format, c.font = "+#,##0;-#,##0;0", Font(name=FONT, color="008000")
    r += 2
    for row in ws.iter_rows(min_row=6, max_row=r - 1, max_col=3):
        for c in row:
            c.border = BOX
            if c.font != Font(name=FONT, color="008000"):
                c.font = BLACK

    # --- 2〜4. クロス集計(件数とエンゲージメント率)
    def cross(title, start, keys, key_range, anchor):
        ws.cell(row=start, column=1, value=title).font = BOLD
        header(ws, start + 1, ["区分", "X 投稿数", "X エンゲージメント率", "Threads 投稿数", "Threads エンゲージメント率"])
        for i, k in enumerate(keys):
            rr = start + 2 + i
            ws.cell(row=rr, column=1, value=k).font = BLACK
            for j, s in ((2, "X"), (4, "Threads")):
                cond = f'{SNS},"{s}",{key_range},$A{rr}'
                c1 = ws.cell(row=rr, column=j, value=f"=COUNTIFS({cond})")
                c1.number_format = "#,##0"
                c2 = ws.cell(row=rr, column=j + 1,
                             value=f"=IF(SUMIFS({IMP},{cond})=0,0,SUMIFS({ENG},{cond})/SUMIFS({IMP},{cond}))")
                c2.number_format = "0.00%"
            for cc in range(1, 6):
                ws.cell(row=rr, column=cc).border = BOX
                if cc > 1:
                    ws.cell(row=rr, column=cc).font = BLACK
        end = start + 1 + len(keys)
        chart = BarChart()
        chart.type = "col"
        chart.title = title.split(". ", 1)[1]
        chart.y_axis.title = "エンゲージメント率"
        chart.y_axis.number_format = "0.0%"
        chart.height, chart.width = 7, 16
        for col in (3, 5):
            chart.add_data(Reference(ws, min_col=col, min_row=start + 1, max_row=end), titles_from_data=True)
        chart.set_categories(Reference(ws, min_col=1, min_row=start + 2, max_row=end))
        ws.add_chart(chart, anchor)
        return end + 2

    r += 1
    r = cross("2. 投稿タイプ別 エンゲージメント率", r, TYPES, TYP, "I4")
    r = cross("3. 曜日別 エンゲージメント率", r, WEEKDAYS, WD, "I20")
    r = cross("4. 時間帯別 エンゲージメント率", r, SLOTS, SLOT, "I36")

    # --- 5. TOP5
    ws.cell(row=r, column=1, value="5. エンゲージメント率 TOP5 投稿(両SNS合算)").font = BOLD
    header(ws, r + 1, ["順位", "投稿日", "SNS", "投稿タイプ", "内容メモ", "インプレッション", "エンゲージメント率"])
    for k in range(1, 6):
        rr = r + 1 + k
        m = f"MATCH(LARGE({RANK},{k}),{RANK},0)"
        vals = [k,
                f"=IFERROR(INDEX({rng('A')},{m}),\"\")",
                f"=IFERROR(INDEX({SNS},{m}),\"\")",
                f"=IFERROR(INDEX({TYP},{m}),\"\")",
                f"=IFERROR(INDEX({rng('E')},{m}),\"\")",
                f"=IFERROR(INDEX({IMP},{m}),\"\")",
                f"=IFERROR(INDEX({ER},{m}),\"\")"]
        fmts = ["0", "yyyy/mm/dd", "@", "@", "@", "#,##0", "0.00%"]
        for j, (v, fmt) in enumerate(zip(vals, fmts), start=1):
            c = ws.cell(row=rr, column=j, value=v)
            c.number_format, c.border, c.font = fmt, BOX, Font(name=FONT, color="008000") if j > 1 else BLACK
    r += 8
    ws.cell(row=r, column=1, value="※ 緑字 = 他シートからの参照、黒字 = このシート内の計算式。数値はすべて自動計算です。").font = Font(name=FONT, italic=True, color="808080")

    for col, w in zip("ABCDEFG", [30, 14, 20, 16, 26, 16, 18]):
        ws.column_dimensions[col].width = w


def main():
    rng = random.Random(20260923)
    wb = Workbook()
    build_guide(wb)
    build_posts(wb, make_posts(rng))
    n = build_followers(wb, make_followers(rng))
    build_summary(wb, n)
    # 既定フォントを Arial に
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if c.font.name != FONT:
                    f = c.font
                    c.font = Font(name=FONT, bold=f.bold, italic=f.italic, size=f.size, color=f.color)
    wb.active = 1
    wb.save(OUT)
    print(f"saved: {OUT}")


if __name__ == "__main__":
    main()
