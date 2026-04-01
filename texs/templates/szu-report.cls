\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{szu-report}

\LoadClass[UTF8,12pt,twoside,scheme=chinese]{ctexart}

\RequirePackage[a4paper,top=25mm, bottom=25mm, left=20mm, right=20mm,headheight=20pt,footskip=15pt]{geometry}
\RequirePackage{fancyhdr}
\RequirePackage{amsmath,mathtools,bm,amssymb,amsfonts}
\everymath{\displaystyle}
\RequirePackage[dvipsnames]{xcolor}
\RequirePackage{pdfpages}
% 图片支持
\RequirePackage{float,graphicx}
\RequirePackage{subcaption,chngcntr} 
% 表格支持
\RequirePackage{multirow,booktabs}

% 列表、枚举
\RequirePackage{enumitem}
\setlist[itemize]{
    itemsep=.5ex,
    topsep=1ex,
    partopsep=0pt,
    parsep=0pt
}
\setlist[enumerate]{
    itemsep=.5ex,
    topsep=1ex,
    partopsep=0pt,
    parsep=0pt
}

% 代码块设置
\RequirePackage{listings}

\lstdefinestyle{inlinecode}{
    basicstyle=\ttfamily\small\color{szu-other}, 
    keywordstyle=\color{szu-main},            
    stringstyle=\color{szu-second},                
    commentstyle=\color{szu-one},    
    showstringspaces=false
}


\lstdefinestyle{multicode}{
    basicstyle=\ttfamily\small\color{black}, 
    keywordstyle=\color{szu-main},            
    stringstyle=\color{szu-second},                
    commentstyle=\color{szu-one},    
    showstringspaces=false,
    breaklines=true,
    aboveskip=10pt,
    belowskip=10pt,
    frame=single
}

\RequirePackage[ruled,vlined]{algorithm2e}
\RequirePackage{setspace}

% 超链接
\RequirePackage[unicode=true,pdfborder={0 0 0},bookmarksnumbered]{hyperref}
\PassOptionsToPackage{hyphens}{url}

% =========================
% 颜色定义
% =========================
\definecolor{szu-main}{HTML}{8A2D4C}
\definecolor{szu-one}{HTML}{787B81}
\definecolor{szu-second}{HTML}{00A652}
\definecolor{szu-third}{HTML}{D8AB71}
\definecolor{szu-other}{HTML}{00AEF7}
% =========================
% 超链接颜色
% =========================
\hypersetup{
    colorlinks=true,
    linkcolor=szu-other,
    urlcolor=szu-main,
    filecolor=szu-second,
    citecolor=szu-third,
    linktoc=all
}


\RequirePackage{cite}

\graphicspath{{figures/}{figure/}{pictures/}{picture/}{pic/}{pics/}{image/}{images/}}
% \setCJKmainfont{Source Han Serif CN} 
% \setCJKsansfont{Source Han Sans CN}

% \renewcommand{\songti}{\CJKfamily{song}}
% \renewcommand{\heiti}{\CJKfamily{hei}}
% \renewcommand{\normalsize}{\zihao{-4}\songti}
% \setmainfont{Times New Roman} 

\setlength{\parindent}{2em} 
\setlength{\parskip}{0pt}
\setlength{\intextsep}{5pt} % 文本与图片间距
\setlength{\abovecaptionskip}{5pt} % 图片与标题间距
\setlength{\belowcaptionskip}{5pt} % 标题与下文间距

\newcommand{\ptitle}[1]{
    \par\vspace{1\baselineskip}
    \begin{center}
        \zihao{3}\heiti\bfseries
        #1
    \end{center}
    \par
    \normalfont\normalsize
    \gdef\leftcomment{#1}
}

\newcommand{\leftcomment}{}

\renewcommand{\sectionmark}[1]{\markboth{#1}{#1}}
\renewcommand{\subsectionmark}[1]{}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot[C]{\fontsize{10}{12}\selectfont \thepage}
% \fancyhead[LE]{\leftmark}    
% \fancyhead[LO]{\leftcomment}     
% \fancyhead[RE]{\leftcomment}     
% \fancyhead[RO]{\leftmark}
\renewcommand{\headrulewidth}{0pt}


\ctexset{
    section = {
        format = \zihao{-3}\heiti\bfseries\raggedright,
        name = {,},
        number = \arabic{section},
        aftername = \quad,
        beforeskip = \baselineskip,
        afterskip = \baselineskip,
    },
    subsection = {
        format = \zihao{4}\heiti\bfseries\raggedright,
        name = {,},
        number = \arabic{section}.\arabic{subsection},
        aftername = \quad,
        beforeskip = 0.5\baselineskip,
        afterskip = 0.5\baselineskip,
    },
    subsubsection = {
        format = \zihao{-4}\heiti\bfseries\raggedright,
        name = {,},
        number = \arabic{section}.\arabic{subsection}.\arabic{subsubsection},
        aftername = \quad,
        beforeskip = 0.5\baselineskip,
        afterskip = 0.5\baselineskip,
    }
}

\renewcommand{\listfigurename}{
    \begin{center}
        \zihao{-3}\heiti \textbf{插图索引}
    \end{center}
} 

\renewcommand{\listtablename}{
    \begin{center}
        \zihao{-3}\heiti \textbf{插表索引}
    \end{center}
}

\makeatletter
\patchcmd{\tableofcontents}
  {\contentsname}
  {
    {
%   {{\vspace*{0.5\baselineskip}   
    \begin{center}
      \zihao{-3}\heiti \bfseries 目\qquad 录
    \end{center}
    \vspace*{0.5\baselineskip}} 
  }
  {}{}
\makeatother



% =========================
% 用户命令（头部、封面信息）
% =========================
\newcommand\coursename[1]{\def\coursename{#1}}
\newcommand\lessonTitle[1]{\def\lessonTitle{#1}}
\newcommand\reportTitle[1]{\def\reportTitle{#1}}
\newcommand\stuname[1]{\def\stuname{#1}}
\newcommand\stuid[1]{\def\stuid{#1}}
\newcommand\inst[1]{\def\inst{#1}}
\newcommand\major[1]{\def\major{#1}}
\renewcommand\date[1]{\def\date{#1}}


% =========================
% 封面命令
% =========================
\makeatletter
\newcommand\dlmu[2][4cm]{\hskip1pt\underline{\hb@xt@ #1{\hss#2\hss}}\hskip3pt}
\makeatother

% 封面设置
\newcommand{\makecover}{
    \newgeometry{margin=5mm}
    \begin{center}
        \begin{figure}
            \centering
            \vspace{.5cm}
            \includegraphics[width=0.8\textwidth]{szu-logo.png}
        \end{figure}

        \vspace*{\fill}
        \heiti \Huge \textbf{{\lessonTitle}} \par
        \vspace{1cm}
        \heiti \Large {\underline{\reportTitle}} \par
        \vspace{3cm}

    \begin{tabular}{@{}p{4em}@{\hspace{0.5em}}p{9cm}@{}}
          \kaishu\Large \makebox[4em][s]{课\hfill 程\hfill 名\hfill 称} & \dlmu[9cm]{\kaishu\Large \coursename} \\
          & \\ 
          \kaishu\Large \makebox[4em][s]{院\hfill 系} & \dlmu[9cm]{\kaishu\Large \inst} \\
          & \\ 
          \kaishu\Large \makebox[4em][s]{组\hfill 员} & \makebox[9cm]{
            \begin{tabular}{c}
                {\kaishu\Large 韩金林 \quad 周伟诺} \\[0.8ex]
                \dlmu[9cm]{\kaishu\Large 秦子亘 \quad 严子卓}
            \end{tabular}
            }  \\
          & \\ 
          \kaishu\Large \makebox[4em][s]{学\hfill 号} & \makebox[9cm]{
            \begin{tabular}{c}
                {\kaishu\Large 2510673039 \quad 2510673040} \\[0.8ex]
                \dlmu[9cm]{\kaishu\Large 2510673045 \quad 2510673046}
            \end{tabular}
            }  \\ 
          & \\
          \kaishu\Large \makebox[4em][s]{专\hfill 业} & \dlmu[9cm]{\kaishu\Large \major} \\
    \end{tabular}

    \vspace*{\fill}

    \kaishu\Large \large \date
    \end{center}
    \thispagestyle{empty}
    \clearpage
    \restoregeometry
}

\makeatletter
\newcommand{\keywords}[1]{%
  \def\@keywords{#1}%
}
\renewenvironment{abstract}{
  \par\small
  \begin{left}
    {\zihao{-4} \textbf{摘\hspace{1em}要}:}
  \end{left}
  \vspace{-1ex}
  \begin{quotation}\zihao{-4}
}{
  \par\vspace{2\baselineskip}
  \noindent{\textbf{关键词：}} \@keywords
  \end{quotation}\par
}
\makeatother


\counterwithin{figure}{section}
\counterwithin{table}{section}
\counterwithin{equation}{section}

\newcommand{\usedefaultbib}[1]{
    \bibliographystyle{unsrt}
    \bibliography{#1}
}


\AtBeginDocument{
    \setlength{\abovedisplayskip}{4pt plus 2pt minus 2pt}
    \setlength{\belowdisplayskip}{4pt plus 2pt minus 2pt}
    \setlength{\abovedisplayshortskip}{2pt plus 1pt minus 1pt}
    \setlength{\belowdisplayshortskip}{2pt plus 1pt minus 1pt}
}

\makeatletter
\g@addto@macro\normalsize{%
  \setlength{\abovedisplayskip}{4pt plus 2pt minus 2pt}%
  \setlength{\belowdisplayskip}{4pt plus 2pt minus 2pt}%
  \setlength{\abovedisplayshortskip}{2pt plus 1pt minus 1pt}%
  \setlength{\belowdisplayshortskip}{2pt plus 1pt minus 1pt}%
}
\normalsize
\makeatother

\endinput
