\ProvidesClass{memory}
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{ctexbook}}
\ProcessOptions\relax
\LoadClass[10pt, a5paper, twoside]{ctexbook}
\RequirePackage{fontspec}
\RequirePackage{amsmath}
\RequirePackage{geometry}
\RequirePackage[frame]{crop}
\geometry{
    papersize={154mm,216mm},
    inner=25mm,   
    outer=15mm,
    top=15mm, 
    bottom=15mm, 
    headheight=15pt, 
    footskip=20pt, 
    bindingoffset=5mm,
    layoutsize={148mm,210mm},
    layoutoffset={3mm,3mm},
}
\RequirePackage{tocloft, enumitem}
\RequirePackage{setspace, pgfmath}
\RequirePackage{tikz}
\RequirePackage{graphicx,eso-pic}
\RequirePackage{subcaption}
\RequirePackage[most]{tcolorbox}
\RequirePackage[dvipsnames]{xcolor}
\RequirePackage{fancyhdr}
\RequirePackage{pgffor}
\RequirePackage{calc, xparse, eso-pic}

\definecolor{toc-main}{HTML}{A2896F}
\definecolor{toc-title}{HTML}{B71C1C}
\definecolor{toc-help}{HTML}{FF6F00}
\definecolor{toc-text}{HTML}{212121}
\definecolor{iceblue}{HTML}{E3F4FF}
\definecolor{snowdark}{RGB}{100,150,200}
\definecolor{romanticbg}{RGB}{250, 240, 235}     
\definecolor{romantictitle}{RGB}{165, 115, 85}
\definecolor{romantictext}{RGB}{90, 60, 45}
\definecolor{romanticaccent}{RGB}{210, 150, 155}



\usetikzlibrary{decorations.pathmorphing, decorations, shapes}
\graphicspath{{figures/}{figure/}{pictures/}{picture/}{pic/}{pics/}{image/}{images/}}
\setmainfont{TeX Gyre Termes}
\onehalfspacing

\fancypagestyle{plain}{
    \fancyhf{} 
    \fancyfoot[C]{    
        \begin{center}
            \rule{0.3\textwidth}{0.1pt} \quad 
            \textcolor{gray}{\thepage} \quad 
            \rule{0.3\textwidth}{0.1pt}
        \end{center}
    }
    \renewcommand{\headrulewidth}{0pt}
    \renewcommand{\footrulewidth}{0pt}
}

\newcommand{\setstyle}[1]{
    \pagestyle{fancy}
    \fancyhf{}
    \fancyhead[LE]{雪藏着一种喜欢} 
    \fancyhead[RO]{#1} 
    \fancyhead[RE]{} 
    \fancyhead[LO]{}
    \fancyfoot[LE]{\thepage}
    \fancyfoot[RO]{\thepage}
    \fancyfoot[RE]{}
    \fancyfoot[LO]{}
    \renewcommand{\headrule}{
                \ifodd\value{page}
                    \vspace{0.5pt}
                    \hfill\color{toc-help}\rule{\widthof{\normalfont#1}+1em}{1.5pt}
                    \vspace{10pt}
                \else
                    \vspace{0.5pt}
                    \color{toc-help}\rule{\widthof{\normalfont 雪藏着一种喜欢}+1em}{1.5pt}
                    \vspace{10pt}
                \fi
            }
    \renewcommand{\headrulewidth}{1pt}
}

\newcommand{\decorate}[1]{
    \begin{center}
        \begin{tikzpicture}[scale=0.5, transform shape]
            \node[align=center, font=\Huge\bfseries, text width=6cm] (title) at (0,0)  {\textcolor{toc-help}{#1}};
            \draw[decorate, decoration={random steps, segment length=4pt, amplitude=1pt}, 
                thick, brown!70!black, rounded corners=2pt] 
                ([xshift=-12pt, yshift=12pt]title.north west) rectangle 
                ([xshift=12pt, yshift=-12pt]title.south east);
            \foreach \x/\y/\rot in {north west/135/0, north east/45/90, south west/-135/270, south east/-45/180} {
                \begin{scope}[shift={(title.\x)}, rotate=\rot]
                    \draw[brown!60!black, thin] 
                        (0.2,0) arc (0:180:0.2) -- cycle;
                    \draw[brown!60!black, thin] 
                        (0.1,0.1) -- (0.3,-0.1);
                \end{scope}
            }
            \foreach \i in {-0.6,-0.3,0,0.3,0.6} {
                \draw[brown!50, thin] 
                    ([xshift=-10pt, yshift=\i*15pt]title.west) -- 
                    ([xshift=-14pt, yshift=\i*15pt]title.west);
                \draw[brown!50, thin] 
                    ([xshift=10pt, yshift=\i*15pt]title.east) -- 
                    ([xshift=14pt, yshift=\i*15pt]title.east);
            }
            \foreach \i in {-0.8,-0.4,0,0.4,0.8} {
                \fill[brown!40] ([xshift=\i*30pt, yshift=10pt]title.north) circle (0.7pt);
                \fill[brown!40] ([xshift=\i*30pt, yshift=-10pt]title.south) circle (0.7pt);
        }
        \end{tikzpicture}
    \end{center}
}

\newcommand{\makecover}{
    \newgeometry{
        papersize={154mm,216mm},
        inner=0mm,   
        outer=0mm,
        top=10mm, 
        bottom=10mm, 
        headheight=15pt, 
        footskip=20pt, 
        % bindingoffset=5mm,
        layoutsize={148mm,210mm},
        layoutoffset={3mm,3mm},
    }
    \begin{center}
        \begin{figure}[!htbp]
            \centering
            \includegraphics[width=\textwidth, height=\textheight, keepaspectratio]{cover.jpg}
        \end{figure}
        \Huge{\bfseries 雪藏着一种喜欢}      
        \par \vspace*{0.5cm}
        \large{作者：诺诺}  
        % \par \vspace*{0.5cm}
        % \small{或许是不知梦的缘故} \hfill
        % \par
        % \small{流离的人追逐幻影} \hfill 
        \vfill
        \small{“二零二三年十二月遇见你便是故事的开始”}  
    \end{center}    
    \thispagestyle{empty}
    \clearpage
    \restoregeometry
}

\newcommand{\makefrontpage}{
    \thispagestyle{empty}
    \begin{center}
        \vspace*{1cm}

        \begin{figure}[!htbp]
            \centering
            \includegraphics[width=0.4\textwidth]{figures/atar.jpg}
        \end{figure}

        \vspace*{1cm}

        {\Huge \bfseries 雪藏着一种喜欢} \par \vspace*{1cm}
        \rule{10cm}{3pt} \par\vspace*{1cm}
        {\Large \bfseries 诺诺/著}

        \bottomtext{“这是一份特殊的礼物，希望你能喜欢”}
    \end{center}
    \clearpage
}

\newcommand{\makeauthor}{
    \newgeometry{
        papersize={154mm,216mm},
        inner=25mm,   
        outer=15mm,
        top=5mm, 
        bottom=5mm, 
        headheight=15pt, 
        footskip=20pt, 
        bindingoffset=5mm,
        layoutsize={148mm,210mm},
        layoutoffset={3mm,3mm},
    }
    \vspace*{0cm}
    \begin{center}
        \begin{figure}[!htbp]
            \centering
            \captionsetup[subfigure]{labelfont=normalfont, font=Large, labelformat=empty}
            \begin{subfigure}{0.31\textwidth}
                \centering
                \includegraphics[width=0.8\linewidth, height=5cm, keepaspectratio]{you.jpg}
                \vspace*{0.5cm}
                % \caption{诺诺}
                % \label{fig:nuonuo}
            \end{subfigure}
            \hfill
            \begin{subfigure}{0.31\textwidth}
                \centering
                \includegraphics[width=0.8\linewidth, height=5cm, keepaspectratio]{heart.png}
                \vspace*{0.5cm}
                % \caption{}
                % \label{fig:heart}
            \end{subfigure}
            \hfill
            \begin{subfigure}{0.31\textwidth}
                \centering
                \includegraphics[width=0.8\linewidth, height=5cm, keepaspectratio]{me.jpg}
                \vspace*{0.5cm}
                % \caption{琳琳}
                % \label{fig:linlin}
            \end{subfigure}
            % \label{fig:winter_memories_triptych}
        \end{figure}
        {
        \Large 
        言语笨拙有些话藏了许久 \par \vspace*{0.4cm} 
        总想用一种最特别的方式告诉你 \par \vspace*{0.4cm}
        于是我决定以一本书的形式记录我们的二周年 \par \vspace*{0.4cm}
        作者是唯一的我 \par \vspace*{0.4cm}
        读者是唯一的你 \par \vspace*{0.4cm}
        全球仅仅此一册 \par \vspace*{0.4cm}
        赠与世间独一无二的读者 \par \vspace*{0.4cm}
        二十岁的涂琳 \par \vspace*{0.4cm}
        你好啊 \par \vspace*{0.4cm}
        很高兴在这一页的时光里认识你 \par \vspace*{0.4cm}
        故事的续篇请多多指教 \par \vspace*{0.4cm}
        ——周伟诺
        }
    \end{center}
    \thispagestyle{empty}
    \clearpage
    \restoregeometry
}

\newcommand{\maketitlepage}{
    \thispagestyle{empty}
    \newgeometry{
        papersize={154mm,216mm},
        inner=25mm,   
        outer=10mm,
        top=5mm, 
        bottom=5mm, 
        headheight=15pt, 
        footskip=20pt, 
        bindingoffset=5mm,
        layoutsize={148mm,210mm},
        layoutoffset={3mm,3mm},
    }
    \vspace*{4cm}
    \noindent \hspace*{1.5cm} \huge{\bfseries{雪藏着一种喜欢}} \par
    \noindent \hspace*{1.5cm} \rule{10cm}{3pt} \par \vspace*{0.5cm}
    \noindent \hspace*{1.42cm} \normalsize{作者：诺诺} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{出品：诺诺} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{封面设计：诺诺} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{创作时间：二零二五年十月至二零二五年十二月} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{E-mail：2095672353@qq.com} \par
    \noindent \hspace*{1.5cm} {\color{gray}\rule{10cm}{1pt}} \par
    \noindent \hspace*{1.5cm} \normalsize{发行：非卖品} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{经销：非卖品} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{开本：140毫米$\times$210毫米} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{版次：二零二五年十二月全球唯一发行版次} \par \vspace*{0.5cm}
    \noindent \hspace*{1.5cm} \normalsize{书号：20231221-20251221} \par
    \noindent \hspace*{1.5cm} {\color{gray}\rule{10cm}{1pt}} \par
    \noindent \hspace*{1.5cm} {\small{本书版权归内容原创者所有，未经作者许可不得转载、复制、翻印.}}
    \restoregeometry
    \clearpage
}

\newcommand{\makefoot}{
    \begin{center}
        \rule{0.3\textwidth}{0.1pt} \quad 
        \textcolor{gray}{\small $\star$} \quad 
        \rule{0.3\textwidth}{0.1pt}
    \end{center}
}
\newcommand{\makepreface}{
    \thispagestyle{empty}
    \decorate{序言}
    \vspace*{2cm}
    \hfill \Large{\bfseries 致亲爱的你} \par \vspace*{0.5cm}
    \Large 
    \begin{center}
        正值国庆中秋佳节 \par \vspace*{0.2cm}
        忽然想写点东西给你 \par \vspace*{0.2cm}
        于是产生了写书的想法 \par  \vspace*{0.2cm}
        或许以后它会被你遗忘在某个角落 \par \vspace*{0.2cm}
        但这都不影响我写在书里想给你看的东西 \par \vspace*{0.2cm}
        我不要山 不要海  \par \vspace*{0.2cm}
        我只想悄悄地 \par \vspace*{0.2cm}
        在黑夜里 偷走月亮  \par \vspace*{0.2cm}
        带着我的情书 走向你 \par \vspace*{0.2cm}
        两周年快乐 \par \vspace*{0.2cm}
        我最爱的涂琳
    \end{center}
    \vfill
    \makefoot
    \clearpage
}

\newcommand{\addcontents}[2]{
    \par \noindent
    {\color{romantictitle} \huge\bfseries{#1}} 
    \hfill 
    {\color{romanticaccent}\large{#2}} 
}
\newcommand{\addsubcontents}[2]{
    \par \noindent
    \hspace*{30pt}
    {\color{romantictext} \Large\bfseries{#1}} 
    \hfill 
    {\color{romanticaccent}\large{#2}} 
}

\newcommand{\maketable}{
    \pagestyle{empty}
    \AddToShipoutPictureBG*{
    \AtPageLowerLeft{
            \color{romanticbg}
            \rule{\paperwidth}{\paperheight}
        }
    }
    \decorate{CONTENTS}
    \vspace*{2cm}
    \addcontents{前传}{1} \par \vspace{0.5cm}
    \addsubcontents{平行时空的我们}{2} \par \vspace{0.5cm}
    \addsubcontents{相遇前的独白}{3} \par \vspace{0.5cm}
    \addsubcontents{相遇——初见几何}{4} \par \vspace{0.5cm}
    \addsubcontents{心动的瞬间}{6} \par \vspace{0.5cm}
    \addcontents{缘起}{7} \par \vspace{0.5cm}
    \addsubcontents{A:Always by your side}{8} \par \vspace{0.5cm}
    \addsubcontents{B:Be with you}{12} \par \vspace{0.5cm}
    \addsubcontents{C:Cherish you forever}{16} \par \vspace{0.5cm}
    \addsubcontents{D:Dear,good night}{19} \par \vspace{0.5cm}
    \addsubcontents{E:Expect the whole of you}{23} \par \vspace{0.5cm}
    \addsubcontents{F:Forever support you}{25} \par \vspace{0.5cm}
    \addsubcontents{G:Give you what you need}{29} \par \vspace{0.5cm}
    \AddToShipoutPictureBG*{
    \AtPageLowerLeft{
            \color{romanticbg}
            \rule{\paperwidth}{\paperheight}
        }
    }
    \addcontents{默契}{32} \par \vspace{0.5cm}
    \addsubcontents{H:Hope you are happy}{33} \par \vspace{0.5cm}
    \addsubcontents{I:I love you}{37} \par \vspace{0.5cm}
    \addsubcontents{J:Just be you}{39} \par \vspace{0.5cm}
    \addsubcontents{K:Kiss you when you wake}{42} \par \vspace{0.5cm}
    \addsubcontents{L:Learn to know you}{47} \par \vspace{0.5cm}
    \addsubcontents{M:Make me yours}{49} \par \vspace{0.5cm}
    \addsubcontents{N:Never make you cry}{52} \par \vspace{0.5cm}
    \addcontents{认定}{55} \par \vspace{0.5cm}
    \addsubcontents{O:Offer my soul}{56} \par \vspace{0.5cm}
    \addsubcontents{P:Put you in my heart}{59} \par \vspace{0.5cm}
    \addsubcontents{Q:Quite your heart}{62} \par \vspace{0.5cm}
    \addsubcontents{R:Run with you}{65} \par \vspace{0.5cm}
    \addsubcontents{S:Share my story}{68} \par \vspace{0.5cm}
    \addsubcontents{T:To be yours}{71} \par \vspace{0.5cm}
    \addsubcontents{U:Understand you}{75} \par \vspace{0.5cm}
    \AddToShipoutPictureBG*{
    \AtPageLowerLeft{
            \color{romanticbg}
            \rule{\paperwidth}{\paperheight}
        }
    }
    \addcontents{相守}{78} \par \vspace{0.5cm}
    \addsubcontents{V:Value this moment}{79} \par \vspace{0.5cm}
    \addsubcontents{W:Walk this path}{81} \par \vspace{0.5cm}
    \addsubcontents{X:XL love}{84} \par \vspace{0.5cm}
    \addsubcontents{Y:Yearn for your presence}{86} \par \vspace{0.5cm}
    \addsubcontents{Z:zeal for you}{88} \par \vspace{0.5cm}
    \addcontents{后记}{91} \par \vspace{0.5cm}
    \addcontents{番外篇}{93} \par \vspace{0.5cm}
    \addsubcontents{我爱你}{95} \par \vspace{0.5cm}
    \addsubcontents{点点滴滴}{96} \par \vspace{0.5cm}
    \addsubcontents{碎碎念}{97} \par \vspace{0.5cm}
    \addsubcontents{我要和你做的一百件事}{98} \par \vspace{0.5cm}
    \addsubcontents{关于吵架}{104} \par \vspace{0.5cm}
    \addsubcontents{序章，及我们}{107} \par \vspace{0.5cm}
    \addsubcontents{写给未来的我们}{111} \par \vspace{0.5cm}
    \addsubcontents{最后一页}{116} 
    \AddToShipoutPictureBG*{
    \AtPageLowerLeft{
            \color{romanticbg}
            \rule{\paperwidth}{\paperheight}
        }
    }
    \clearpage
}

\newcommand{\history}{
    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.02.25}} \quad {\small 那个午后的吉安，我们在老站台的光影里，初次照面}

    \small 
    \begin{enumerate}
        \item 烤肠
        \item 第一次牵手、拥抱
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.02.28}} \quad {\small{你人生的篇章，第一次翻到了名为“北京”的这一页}}

    \small
    \begin{enumerate}
        \item 鼓楼——时光走漏了风声
        \item 什刹海——冰面与云的倒影
        \item 天安门广场——长安街日落大道
        \item 景山公园——一站式鸟瞰故宫
        \item 天坛公园——天心石的回响
        \item 北京CBD——中央电视台所在地
        \item 太古里三里屯——朝阳区较火的商圈
        \item 吃过的美食：北京烤鸭、炸酱面、奶皮子酸奶、豆汁、焦圈、稻香村
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.03.13}} \quad {\small{耳畔第一次浸润了天津的市井交响和北京的人文画卷}}

    \small
    \begin{enumerate}
        \item 天津之眼——摩天轮
        \item 解放桥——一道横跨海河的沉默年轮
        \item 海河意式风情区——一个被红砖与浪漫凝固的世纪前的航海梦
        \item 津湾广场——海河岸边一曲凝固的都市乐章
        \item 瓷房子——青花瓷的幻境
        \item 东疆建设开发纪念公园——日落尤其温柔
        \item 东疆亲海公园——早起看日出本身就是一种浪漫
        \item 国家海洋博物馆——承载着一些浪花的记忆
        \item 五大道文化旅游区——惬意的午后
        \item 吃过的美食：煎饼果子、梨花糕等等
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.05.01}} \quad {\small{我第一次与南昌初晤，同抚州浅谈}}

    \small
    \begin{enumerate}
        \item 八一广场——晨曦与星辉之间的沉默对答
        \item 王府井商圈——永不落幕的消费
        \item 见陆总的时光——一开始还挺尴尬的哈哈哈
        \item 文昌里历史文化街区——个被月光浸透的戏梦
        \item 佛岭国际公园——一起爬山看塔顶，塔顶的风真的很大
        \item 看电影——末路狂花钱，一部不错的喜剧
        \item 157天纪念日——时光长河里，我们共同打捞的闪光坐标
        \item 吃过的美食：抚州泡粉、火锅、牛蛙等等
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.07.27}} \quad {\small{再度奔赴南昌，续写半章}}

    \small
    \begin{enumerate}
        \item 双港地铁站
        \item 陪你准备专升本考试
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.10.24}} \quad {\small{为了奶皮子酸奶，你来了北京三次}}

    \small
    \begin{enumerate}
        \item 偷偷来学校给我惊喜——你如惊喜的句点，落在我平凡的日子里
        \item 奥森公园——步履轻盈，漫游在落叶与自由之间
        \item 雍和宫——香火缭绕处，静听梵音入心
        \item 鸟巢——巨型钢构，托起一座城市的运动梦想
        \item 水立方——波光流转，如水温柔的夜晚
        \item 北京胡同——拐进弯弯绕绕，拾取老北京的烟火人间
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.12.5}} \quad {\small{我第三次来到南昌这座城}}

    \small
    \begin{enumerate}
        \item 一周年纪念日——一次终身难忘的经历
        \item 陪你准备专升本考试
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2024.12.22}} \quad {\small{你第一次来到深圳}}

    \small
    \begin{enumerate}
        \item 来到我家——温暖灯火
        \item 深圳湾公园——海风、步道与天际线的温柔邂逅
        \item 莲花山公园——在城市的绿心，遥望未来书卷
        \item 大梅沙——海浪在脚下铺开银色的浪漫
        \item 深圳之眼——收揽流转的城市光华
        \item 各种商场
    \end{enumerate}
    
    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2025.01.10}} \quad {\small{我和你一起回到了吉安}}

    \begin{enumerate}
        \item 备考专升本考试
        \item 一起吃了很多很多好吃的爱吃的
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2025.02.17}} \quad {\small{在南昌的备考阶段}}

    \begin{enumerate}
        \item 备考专升本考试
        \item 在紫荆夜市的时光，有争吵也有欢乐
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2025.03.06}} \quad {\small{临近考试的关键时期——南昌与吉安}}

    \begin{enumerate}
        \item 专升本考试
        \item 由衷的祝福你通过了考试
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2025.06.07}} \quad {\small{厦门}}

    \begin{enumerate}
        \item 关系破碎，我试图挽回
        \item 逛商场的一天，期间讨论了一些话题
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \noindent {\small{\color{toc-help}2025.07.28} }\quad {\small{广州、深圳、香港}}

    \begin{enumerate}
        \item 广州塔——云端之上，触摸城市的钢铁柔情
        \item 批发城买衣服——人潮声里，淘洗属于我们的日常风景
        \item 圣心大教堂——彩色玻璃下，光与信仰一同静静流淌
        \item 永庆坊——趟栊门后，听见西关旧梦的温柔回响
        \item 大佛寺——明灯古刹，梵音沉入都市的夜色苍茫
        \item 北京路步行街——千年城脉，托起今日喧闹的市井长廊
        \item 流花湖公园——风过棕榈，水光中漾起一个慵懒的午后
        \item 陈家祠——岭南精雕，凝固了岁月与匠心的无声诗行
        \item 思维创汇——在白板与咖啡之间，碰撞出思想的星芒
        \item 深圳美术馆——艺术静默，留白处听见内心的回响
        \item 壹方天地——琳琅光影，包裹着现代生活的所有想象
        \item 西湾红树林公园——落日长滩，飞鸟与晚风共写一首漫长散文
        \item 朗豪坊——潮流漩涡，购物袋里装满青春的重量
        \item 星际城市——相机与镜头，对准了这个时代的视觉梦工厂
        \item 天星小轮——汽笛声中，摇曳过维港的百年波光
        \item 中环摩天轮——繁华之眼，将都市浪漫转到最高一章
    \end{enumerate}

    \noindent\hspace*{-\dimexpr\oddsidemargin+1in\relax}
    {\color{toc-help}\rule{\dimexpr\paperwidth-2cm\relax}{0.8pt}}

    \bottomtext{“每一次见面都是一场绝妙的交响曲”}
}


\newcommand{\makebackcover}{
    \clearpage
    \thispagestyle{empty}
    \newgeometry{top=5mm,bottom=5mm}
    \vspace*{0.5cm} \small{雪藏着一种喜欢——让生活更有仪式感}
    \begin{center}
        \begin{minipage}{0.6\textwidth}
            \includegraphics[width=\textwidth, keepaspectratio]{backcover.jpg}
            \par
            \raggedleft 在这个世界的某个角落 \\[10pt]
            \raggedleft 必有为你而生的人 \\[10pt]
            \raggedleft 当你在悬崖尽头时不要失去希望 \\[10pt]
            \raggedleft 要多坚持那么一秒钟 \\[10pt]
            \raggedleft 等那个人一骑绝尘如狂风闪电般出现在你面前 \\[10pt]
            \raggedleft 而我一直在等你
        \end{minipage}
    \end{center}
    \begin{tikzpicture}[remember picture, overlay]
        \node [anchor=south east, xshift=-0.5cm, yshift=0.5cm] at (current page.south east) {
            \begin{minipage}{3cm}
                \centering
                \small{礼物<2025-12-21>} \\ [0.1cm]
                \includegraphics[width=3cm]{qrcode.png} 
                \small{231221-251221}
            \end{minipage}
        };
    \end{tikzpicture}
    \clearpage
    \restoregeometry
}

\newcommand{\card}[4]{
    \clearpage
    \thispagestyle{empty}
    \newgeometry{
        papersize={154mm,216mm},
        inner=25mm,   
        outer=15mm,
        top=5mm, 
        bottom=20mm, 
        headheight=15pt, 
        footskip=20pt, 
        bindingoffset=5mm,
        layoutsize={148mm,210mm},
        layoutoffset={3mm,3mm},
    }
    \begin{center}
        \begin{figure}[!htbp]
            \centering
            \includegraphics[width=\textwidth]{#1}
        \end{figure}
        \vspace*{2cm}
        {\huge\bfseries【#2】} \par \vspace{0.5cm}
        {\Huge\bfseries #3} \par \vspace{0.5cm}
        \rule{1.5cm}{1.5pt} \par \vspace{0.5cm}
        \Large\bfseries{#4} 
    \end{center}
    \restoregeometry
    \pagestyle{fancy}
    \clearpage
}

\newcommand{\subtitle}[1]{
    \vspace*{0.2cm}
    \begin{center}
        \Large \bfseries {\color{toc-title}{#1}}
    \end{center}
    % \vspace*{\baselineskip}
}

\newcommand{\subsubtitle}[1]{
    \vspace*{0.1cm}
    \begin{flushleft}
        \large \bfseries {\color{toc-text}{#1}}
    \end{flushleft}
    % \vspace*{0.5\baselineskip}
}

\newtcolorbox{bbox}[1][]{
    enhanced,
    frame style={left color=blue!30, right color=purple!30},
    interior style={left color=white, right color=blue!5},
    colframe=blue!50!black,
    colback=white,
    arc=4mm,
    boxrule=1.5pt,
    underlay={
        \begin{tcbclipinterior}
            \shade[inner color=blue!10, outer color=white] 
                (interior.north west) circle (1cm);
            \shade[inner color=purple!10, outer color=white] 
                (interior.south east) circle (1cm);
        \end{tcbclipinterior}
    },
    drop fuzzy shadow=blue!50!black,
    #1
}

\newcommand{\bottomtext}[1]{
    \AddToShipoutPictureBG*{
        \AtPageLowerLeft{
            \put(\LenToUnit{0.5\paperwidth},\LenToUnit{\dimexpr\footskip+0.8cm\relax}){
                \makebox[0pt]{\small\itshape #1}
            }
        }
    }
}