/**
 * РАСШИРЕННЫЕ СЛОВАРИ КОМПЛЕКТУЮЩИХ (2004-2024)
 * Каждое значение используется для многомерного кодирования
 */
const dictionaries = {
    cpu: {
        intel: {
            intel: {
			brands: [
				// Старые поколения (2004-2008)
				"Intel Pentium 4", "Intel Pentium D", "Intel Pentium M", "Intel Pentium Dual-Core", "Intel Core Solo", "Intel Core Duo", "Intel Core 2 Duo", "Intel Core 2 Quad", "Intel Core 2 Extreme",
				
				// Atom серии (нетбуки, планшеты)
				"Intel Atom N", "Intel Atom Z","Intel Atom x3","Intel Atom x5", "Intel Atom x7",
				
				// Core m серии (ультрабуки)
				"Intel Core m3-6xxx", "Intel Core m5-6xxx", "Intel Core m7-6xxx", "Intel Core m3-7xxx", "Intel Core m3-8xxx",
				
				// Core i поколения 1-14 (все SKU)
				"Intel Core i3-1xxx", "Intel Core i5-1xxx", "Intel Core i7-1xxx",
				
				"Intel Core i3-2xxx", "Intel Core i5-2xxx", "Intel Core i7-2xxx",
				
				"Intel Core i3-3xxx", "Intel Core i5-3xxx",
				"Intel Core i7-3xxx",
				
				"Intel Core i3-4xxx", // Haswell
				"Intel Core i5-4xxx",
				"Intel Core i7-4xxx",
				
				"Intel Core i3-5xxx", // Broadwell
				"Intel Core i5-5xxx",
				"Intel Core i7-5xxx",
				
				"Intel Core i3-6xxx", // Skylake
				"Intel Core i5-6xxx",
				"Intel Core i7-6xxx",
				
				"Intel Core i3-7xxx", // Kaby Lake
				"Intel Core i5-7xxx",
				"Intel Core i7-7xxx",
				
				"Intel Core i3-8xxx", // Coffee Lake
				"Intel Core i5-8xxx",
				"Intel Core i7-8xxx",
				"Intel Core i9-8xxx",
				
				"Intel Core i3-9xxx", // Coffee Lake Refresh
				"Intel Core i5-9xxx",
				"Intel Core i7-9xxx",
				"Intel Core i9-9xxx",
				
				"Intel Core i3-10xxx", // Comet Lake
				"Intel Core i5-10xxx",
				"Intel Core i7-10xxx",
				"Intel Core i9-10xxx",
				
				"Intel Core i3-11xxx", // Rocket Lake
				"Intel Core i5-11xxx",
				"Intel Core i7-11xxx",
				"Intel Core i9-11xxx",
				
				"Intel Core i3-12xxx", // Alder Lake
				"Intel Core i5-12xxx",
				"Intel Core i7-12xxx",
				"Intel Core i9-12xxx",
				
				"Intel Core i3-13xxx", // Raptor Lake
				"Intel Core i5-13xxx",
				"Intel Core i7-13xxx",
				"Intel Core i9-13xxx",
				
				"Intel Core i3-14xxx", // Raptor Lake Refresh
				"Intel Core i5-14xxx",
				"Intel Core i7-14xxx",
				"Intel Core i9-14xxx",
				
				// Core Ultra (Meteor Lake, 2023+)
				"Intel Core Ultra 5",
				"Intel Core Ultra 7",
				"Intel Core Ultra 9",
				
				// Xeon серии
				"Intel Xeon E3-1xxx",
				"Intel Xeon E3-12xx",
				"Intel Xeon E5-1xxx",
				"Intel Xeon E5-2xxx",
				"Intel Xeon E5-4xxx",
				"Intel Xeon E7",
				"Intel Xeon W-1xxx",
				"Intel Xeon W-2xxx",
				"Intel Xeon W-3xxx",
				"Intel Xeon Gold",
				"Intel Xeon Silver",
				"Intel Xeon Platinum",
				"Intel Xeon Bronze",
				"Intel Xeon D",
				"Intel Xeon Phi",
				
				// Celeron/Pentium современные
				"Intel Celeron G",
				"Intel Celeron N",
				"Intel Celeron J",
				"Intel Pentium Gold G",
				"Intel Pentium Silver J",
				"Intel Pentium Silver N"
			],
			
			suffixes: [
				"", 
				// Десктопные
				"K",      // Unlocked (разблокированный множитель)
				"F",      // No iGPU (без встроенной графики)
				"KF",     // Unlocked + No iGPU
				"KS",     // Special Edition (еще выше частоты)
				"T",      // Low power (низкое энергопотребление)
				"S",      // Performance-optimized
				"P",      // Performance
				"E",      // Embedded
				"X",      // Extreme Edition
				"XE",     // Extreme Edition Enhanced
				
				// Мобильные
				"U",      // Ultra-low power (15W)
				"Y",      // Extremely low power (5-7W)
				"H",      // High performance mobile (45W)
				"HK",     // High performance + Unlocked
				"HX",     // Highest mobile performance (55W+)
				"HQ",     // High performance Quad-core
				"G1", "G4", "G7", // Graphics level indicators
				"M",      // Mobile
				"MQ",     // Mobile Quad-core
				"QM",     // Quad-core Mobile
				
				// Специальные
				"C",      // Desktop with high-performance graphics
				"R",      // Desktop BGA (soldered)
				"G",      // With discrete graphics
				"GE"      // Low power embedded
			],
            speeds: ["1.6", "1.8", "2.0", "2.2", "2.4", "2.6", "2.8", "3.0", "3.2", "3.4", "3.6", "3.8", "4.0", "4.2", "4.4", "4.6", "4.8", "5.0", "5.2", "5.4", "5.6", "5.8", "6.0"]
        },
        amd: {
            brands: [
				// Старые поколения (2004-2010)
				"AMD Sempron",
				"AMD Athlon 64",
				"AMD Athlon 64 X2",
				"AMD Athlon 64 FX",
				"AMD Athlon II X2",
				"AMD Athlon II X3",
				"AMD Athlon II X4",
				"AMD Turion 64",
				"AMD Turion 64 X2",
				"AMD Turion II",
				"AMD Opteron",
				
				// Phenom серии
				"AMD Phenom X3",
				"AMD Phenom X4",
				"AMD Phenom II X2",
				"AMD Phenom II X3",
				"AMD Phenom II X4",
				"AMD Phenom II X6",
				
				// FX серии (Bulldozer)
				"AMD FX-4xxx",
				"AMD FX-6xxx",
				"AMD FX-8xxx",
				"AMD FX-9xxx",
				
				// APU A-серии (Llano, Trinity, Richland, Kaveri, Godavari)
				"AMD A4-3xxx",
				"AMD A4-4xxx",
				"AMD A4-5xxx",
				"AMD A4-6xxx",
				"AMD A4-7xxx",
				"AMD A4-9xxx",
				"AMD A6-3xxx",
				"AMD A6-5xxx",
				"AMD A6-6xxx",
				"AMD A6-7xxx",
				"AMD A6-9xxx",
				"AMD A8-3xxx",
				"AMD A8-5xxx",
				"AMD A8-6xxx",
				"AMD A8-7xxx",
				"AMD A8-9xxx",
				"AMD A10-5xxx",
				"AMD A10-6xxx",
				"AMD A10-7xxx",
				"AMD A10-9xxx",
				"AMD A12-9xxx",
				
				// Athlon современные (Zen)
				"AMD Athlon 200GE",
				"AMD Athlon 220GE",
				"AMD Athlon 240GE",
				"AMD Athlon 3000G",
				"AMD Athlon Gold",
				"AMD Athlon Silver",
				
				// Ryzen 1000 (Summit Ridge, Raven Ridge)
				"AMD Ryzen 3 1xxx",
				"AMD Ryzen 5 1xxx",
				"AMD Ryzen 7 1xxx",
				
				// Ryzen 2000 (Pinnacle Ridge, Picasso)
				"AMD Ryzen 3 2xxx",
				"AMD Ryzen 5 2xxx",
				"AMD Ryzen 7 2xxx",
				"AMD Ryzen Threadripper 1xxx",
				"AMD Ryzen Threadripper 2xxx",
				
				// Ryzen 3000 (Matisse, Renoir)
				"AMD Ryzen 3 3xxx",
				"AMD Ryzen 5 3xxx",
				"AMD Ryzen 7 3xxx",
				"AMD Ryzen 9 3xxx",
				"AMD Ryzen Threadripper 3xxx",
				
				// Ryzen 4000 (Renoir Desktop)
				"AMD Ryzen 3 4xxx",
				"AMD Ryzen 5 4xxx",
				"AMD Ryzen 7 4xxx",
				"AMD Ryzen 9 4xxx",
				
				// Ryzen 5000 (Vermeer, Cezanne)
				"AMD Ryzen 3 5xxx",
				"AMD Ryzen 5 5xxx",
				"AMD Ryzen 7 5xxx",
				"AMD Ryzen 9 5xxx",
				
				// Ryzen 7000 (Raphael, Phoenix)
				"AMD Ryzen 3 7xxx",
				"AMD Ryzen 5 7xxx",
				"AMD Ryzen 7 7xxx",
				"AMD Ryzen 9 7xxx",
				
				// Ryzen 8000 (Hawk Point)
				"AMD Ryzen 5 8xxx",
				"AMD Ryzen 7 8xxx",
				"AMD Ryzen 9 8xxx",
				
				// Ryzen 9000 (Zen 5)
				"AMD Ryzen 5 9xxx",
				"AMD Ryzen 7 9xxx",
				"AMD Ryzen 9 9xxx",
				
				// Threadripper
				"AMD Ryzen Threadripper 1xxx",
				"AMD Ryzen Threadripper 2xxx",
				"AMD Ryzen Threadripper 3xxx",
				"AMD Ryzen Threadripper PRO 3xxx",
				"AMD Ryzen Threadripper PRO 5xxx",
				"AMD Ryzen Threadripper 7xxx",
				
				// EPYC серверные
				"AMD EPYC 7xx1", // Naples
				"AMD EPYC 7xx2", // Rome
				"AMD EPYC 7xx3", // Milan
				"AMD EPYC 9xx4", // Genoa
				"AMD EPYC 8xx4", // Siena
				"AMD EPYC 9xx5"  // Turin
			],
            models: Array.from({length: 9999}, (_, i) => String(i + 1000).padStart(4, '0')),
            suffixes: ["", "X", "G", "GE", "X3D", "XT", "E", "U", "H", "HS", "HX", "M", "C", "E", "P", "WX"],
            speeds: ["2.0", "2.2", "2.5", "2.8", "3.0", "3.2", "3.4", "3.6", "3.8", "4.0", "4.2", "4.4", "4.6", "4.8", "5.0", "5.2", "5.4", "5.6", "5.8"]
        }
    },

    gpu: {
        nvidia: {
			series: [
				// Ранние поколения (2004-2006)
				"GeForce FX 5200",
				"GeForce FX 5500",
				"GeForce FX 5600",
				"GeForce FX 5700",
				"GeForce FX 5800",
				"GeForce FX 5900",
				"GeForce FX 5950",
				
				// GeForce 6 серия (2004-2005)
				"GeForce 6200",
				"GeForce 6600",
				"GeForce 6800",
				
				// GeForce 7 серия (2005-2006)
				"GeForce 7300",
				"GeForce 7600",
				"GeForce 7800",
				"GeForce 7900",
				"GeForce 7950",
				
				// GeForce 8 серия (2006-2007)
				"GeForce 8300",
				"GeForce 8400",
				"GeForce 8500",
				"GeForce 8600",
				"GeForce 8800",
				
				// GeForce 9 серия (2008)
				"GeForce 9300",
				"GeForce 9400",
				"GeForce 9500",
				"GeForce 9600",
				"GeForce 9800",
				
				// GeForce 100 серия (2009)
				"GeForce GT 120",
				"GeForce GT 130",
				"GeForce GTS 150",
				
				// GeForce 200 серия (2008-2009)
				"GeForce GT 220",
				"GeForce GT 230",
				"GeForce GT 240",
				"GeForce GTS 250",
				"GeForce GTX 260",
				"GeForce GTX 270",
				"GeForce GTX 275",
				"GeForce GTX 280",
				"GeForce GTX 285",
				"GeForce GTX 295",
				
				// GeForce 300 серия (2010, ребрендинг)
				"GeForce GT 320",
				"GeForce GT 330",
				"GeForce GT 340",
				
				// GeForce 400 серия (2010, Fermi)
				"GeForce GT 420",
				"GeForce GT 430",
				"GeForce GT 440",
				"GeForce GTS 450",
				"GeForce GTX 460",
				"GeForce GTX 465",
				"GeForce GTX 470",
				"GeForce GTX 480",
				
				// GeForce 500 серия (2011, Fermi refresh)
				"GeForce GT 520",
				"GeForce GT 530",
				"GeForce GT 540",
				"GeForce GTS 550",
				"GeForce GTX 550",
				"GeForce GTX 560",
				"GeForce GTX 570",
				"GeForce GTX 580",
				"GeForce GTX 590",
				
				// GeForce 600 серия (2012, Kepler)
				"GeForce GT 610",
				"GeForce GT 620",
				"GeForce GT 630",
				"GeForce GT 640",
				"GeForce GTX 645",
				"GeForce GTX 650",
				"GeForce GTX 660",
				"GeForce GTX 670",
				"GeForce GTX 680",
				"GeForce GTX 690",
				
				// GeForce 700 серия (2013, Kepler refresh)
				"GeForce GT 705",
				"GeForce GT 710",
				"GeForce GT 720",
				"GeForce GT 730",
				"GeForce GT 740",
				"GeForce GTX 745",
				"GeForce GTX 750",
				"GeForce GTX 760",
				"GeForce GTX 770",
				"GeForce GTX 780",
				"GeForce GTX 790",
				"GeForce GTX TITAN",
				"GeForce GTX TITAN Black",
				"GeForce GTX TITAN Z",
				
				// GeForce 900 серия (2014-2015, Maxwell)
				"GeForce GTX 950",
				"GeForce GTX 960",
				"GeForce GTX 970",
				"GeForce GTX 980",
				"GeForce GTX 980 Ti",
				"GeForce GTX TITAN X",
				
				// GeForce 10 серия (2016-2017, Pascal)
				"GeForce GT 1010",
				"GeForce GT 1030",
				"GeForce GTX 1050",
				"GeForce GTX 1060",
				"GeForce GTX 1070",
				"GeForce GTX 1080",
				"GeForce GTX TITAN X",
				"GeForce GTX TITAN Xp",
				
				// GeForce 16 серия (2019, Turing без RT)
				"GeForce GTX 1630",
				"GeForce GTX 1650",
				"GeForce GTX 1660",
				
				// GeForce 20 серия (2018-2019, Turing)
				"GeForce RTX 2060",
				"GeForce RTX 2070",
				"GeForce RTX 2080",
				"GeForce RTX TITAN",
				
				// GeForce 30 серия (2020-2022, Ampere)
				"GeForce RTX 3050",
				"GeForce RTX 3060",
				"GeForce RTX 3070",
				"GeForce RTX 3080",
				"GeForce RTX 3090",
				
				// GeForce 40 серия (2022+, Ada Lovelace)
				"GeForce RTX 4060",
				"GeForce RTX 4070",
				"GeForce RTX 4080",
				"GeForce RTX 4090",
				
				// MX серии (бюджетные мобильные)
				"GeForce MX110",
				"GeForce MX130",
				"GeForce MX150",
				"GeForce MX230",
				"GeForce MX250",
				"GeForce MX330",
				"GeForce MX350",
				"GeForce MX450",
				"GeForce MX550",
				"GeForce MX570",
				
				// Quadro серии (профессиональные)
				"Quadro FX 380",
				"Quadro FX 580",
				"Quadro FX 1xxx",
				"Quadro FX 3xxx",
				"Quadro FX 4xxx",
				"Quadro FX 5xxx",
				"Quadro K420",
				"Quadro K620",
				"Quadro K1200",
				"Quadro K2200",
				"Quadro K4200",
				"Quadro K5200",
				"Quadro K6000",
				"Quadro M2000",
				"Quadro M4000",
				"Quadro M5000",
				"Quadro M6000",
				"Quadro P400",
				"Quadro P600",
				"Quadro P1000",
				"Quadro P2200",
				"Quadro P4000",
				"Quadro P5000",
				"Quadro P6000",
				"Quadro RTX 4000",
				"Quadro RTX 5000",
				"Quadro RTX 6000",
				"Quadro RTX 8000",
				
				// RTX A-серии (профессиональные, замена Quadro)
				"RTX A2000",
				"RTX A4000",
				"RTX A4500",
				"RTX A5000",
				"RTX A5500",
				"RTX A6000",
				
				// Tesla серии (вычислительные)
				"Tesla C2050",
				"Tesla C2070",
				"Tesla K10",
				"Tesla K20",
				"Tesla K40",
				"Tesla K80",
				"Tesla M4",
				"Tesla M6",
				"Tesla M10",
				"Tesla M40",
				"Tesla M60",
				"Tesla P4",
				"Tesla P6",
				"Tesla P40",
				"Tesla P100",
				"Tesla V100",
				"Tesla T4",
				
				// CMP серии (майнинговые)
				"CMP 30HX",
				"CMP 40HX",
				"CMP 50HX",
				"CMP 70HX"
			],
			
			variants: [
				"",
				"Ti",           // Titanium (улучшенная версия)
				"Super",        // Между базовой и Ti
				"Ti Super",     // Комбинация
				"SE",           // Special Edition
				"LE",           // Limited Edition
				"GS",           // G-Sync
				"GT",           // Gran Turismo
				"GX2",          // Dual GPU
				"OC",           // Overclocked
				"FE",           // Founders Edition
				"Gaming",       // Gaming Edition
				"Gaming X",     // MSI Gaming X
				"Turbo",        // Turbo Edition
				"Strix",        // ASUS ROG Strix
				"Amp",          // Zotac Amp
				"FTW3",         // EVGA FTW3
				"Lightning",    // MSI Lightning
				"Kingpin",      // EVGA Kingpin
				"HOF",          // Hall of Fame (Galax)
				"iChill",       // Inno3D iChill
				"Black",        // Titan Black
				"Z"             // Titan Z (dual GPU)
			],
			
			vram: [
				"128MB", "256MB", "512MB", "768MB",
				"1GB", "1.5GB", "2GB", "3GB", "4GB", 
				"6GB", "8GB", "10GB", "11GB", "12GB", 
				"16GB", "20GB", "24GB", "48GB"
			]
		},
        amd: {
			series: [
				// Старые ATI поколения (до 2006)
				"ATI Rage 128",
				"ATI Rage Fury",
				"ATI Radeon 7xxx",
				"ATI Radeon 8xxx",
				"ATI Radeon 9xxx",
				
				// ATI Radeon X серии (2004-2006)
				"ATI Radeon X300",
				"ATI Radeon X550",
				"ATI Radeon X600",
				"ATI Radeon X700",
				"ATI Radeon X800",
				"ATI Radeon X850",
				"ATI Radeon X1300",
				"ATI Radeon X1600",
				"ATI Radeon X1800",
				"ATI Radeon X1900",
				"ATI Radeon X1950",
				
				// ATI Radeon HD 2xxx (2007, R600)
				"ATI Radeon HD 2400",
				"ATI Radeon HD 2600",
				"ATI Radeon HD 2900",
				
				// ATI Radeon HD 3xxx (2008, RV670)
				"ATI Radeon HD 3450",
				"ATI Radeon HD 3650",
				"ATI Radeon HD 3850",
				"ATI Radeon HD 3870",
				
				// ATI Radeon HD 4xxx (2008-2009, RV770)
				"ATI Radeon HD 4350",
				"ATI Radeon HD 4550",
				"ATI Radeon HD 4650",
				"ATI Radeon HD 4670",
				"ATI Radeon HD 4770",
				"ATI Radeon HD 4830",
				"ATI Radeon HD 4850",
				"ATI Radeon HD 4870",
				"ATI Radeon HD 4890",
				
				// ATI Radeon HD 5xxx (2009-2010, Evergreen)
				"ATI Radeon HD 5450",
				"ATI Radeon HD 5550",
				"ATI Radeon HD 5570",
				"ATI Radeon HD 5670",
				"ATI Radeon HD 5750",
				"ATI Radeon HD 5770",
				"ATI Radeon HD 5830",
				"ATI Radeon HD 5850",
				"ATI Radeon HD 5870",
				
				// ATI Radeon HD 6xxx (2010-2011, Northern Islands)
				"ATI Radeon HD 6450",
				"ATI Radeon HD 6570",
				"ATI Radeon HD 6670",
				"ATI Radeon HD 6750",
				"ATI Radeon HD 6770",
				"ATI Radeon HD 6850",
				"ATI Radeon HD 6870",
				"ATI Radeon HD 6950",
				"ATI Radeon HD 6970",
				"ATI Radeon HD 6990",
				
				// AMD Radeon HD 7xxx (2012, Southern Islands - GCN 1.0)
				"AMD Radeon HD 7750",
				"AMD Radeon HD 7770",
				"AMD Radeon HD 7850",
				"AMD Radeon HD 7870",
				"AMD Radeon HD 7950",
				"AMD Radeon HD 7970",
				"AMD Radeon HD 7990",
				
				// AMD Radeon HD 8xxx (2013, OEM/Mobile)
				"AMD Radeon HD 8350",
				"AMD Radeon HD 8450",
				"AMD Radeon HD 8570",
				"AMD Radeon HD 8670",
				
				// AMD Radeon R5/R7/R9 200 серии (2013-2014, GCN 1.1/2.0)
				"AMD Radeon R5 230",
				"AMD Radeon R5 235",
				"AMD Radeon R5 240",
				"AMD Radeon R7 240",
				"AMD Radeon R7 250",
				"AMD Radeon R7 260",
				"AMD Radeon R7 265",
				"AMD Radeon R9 270",
				"AMD Radeon R9 280",
				"AMD Radeon R9 285",
				"AMD Radeon R9 290",
				"AMD Radeon R9 295",
				
				// AMD Radeon R5/R7/R9 300 серии (2015, Volcanic Islands)
				"AMD Radeon R5 330",
				"AMD Radeon R5 340",
				"AMD Radeon R7 340",
				"AMD Radeon R7 350",
				"AMD Radeon R7 360",
				"AMD Radeon R7 370",
				"AMD Radeon R9 370",
				"AMD Radeon R9 380",
				"AMD Radeon R9 390",
				"AMD Radeon R9 Fury",
				"AMD Radeon R9 Nano",
				
				// AMD Radeon RX 400 серии (2016, Polaris - GCN 4.0)
				"AMD Radeon RX 430",
				"AMD Radeon RX 440",
				"AMD Radeon RX 450",
				"AMD Radeon RX 460",
				"AMD Radeon RX 470",
				"AMD Radeon RX 480",
				
				// AMD Radeon RX 500 серии (2017, Polaris refresh)
				"AMD Radeon RX 530",
				"AMD Radeon RX 540",
				"AMD Radeon RX 550",
				"AMD Radeon RX 560",
				"AMD Radeon RX 570",
				"AMD Radeon RX 580",
				"AMD Radeon RX 590",
				
				// AMD Radeon RX Vega (2017-2018, Vega - GCN 5.0)
				"AMD Radeon RX Vega 56",
				"AMD Radeon RX Vega 64",
				"AMD Radeon VII",
				
				// AMD Radeon RX 5xxx (2019-2020, Navi - RDNA 1.0)
				"AMD Radeon RX 5300",
				"AMD Radeon RX 5500",
				"AMD Radeon RX 5600",
				"AMD Radeon RX 5700",
				
				// AMD Radeon RX 6xxx (2020-2022, Navi 2x - RDNA 2.0)
				"AMD Radeon RX 6400",
				"AMD Radeon RX 6500",
				"AMD Radeon RX 6600",
				"AMD Radeon RX 6650",
				"AMD Radeon RX 6700",
				"AMD Radeon RX 6750",
				"AMD Radeon RX 6800",
				"AMD Radeon RX 6900",
				"AMD Radeon RX 6950",
				
				// AMD Radeon RX 7xxx (2022+, Navi 3x - RDNA 3.0)
				"AMD Radeon RX 7600",
				"AMD Radeon RX 7700",
				"AMD Radeon RX 7800",
				"AMD Radeon RX 7900",
				
				// AMD Radeon Pro (профессиональные)
				"AMD Radeon Pro WX 2100",
				"AMD Radeon Pro WX 3200",
				"AMD Radeon Pro WX 4100",
				"AMD Radeon Pro WX 5100",
				"AMD Radeon Pro WX 7100",
				"AMD Radeon Pro WX 8200",
				"AMD Radeon Pro WX 9100",
				"AMD Radeon Pro W5500",
				"AMD Radeon Pro W5700",
				"AMD Radeon Pro W6600",
				"AMD Radeon Pro W6800",
				
				// AMD FirePro (старые профессиональные)
				"AMD FirePro V3900",
				"AMD FirePro V4900",
				"AMD FirePro V5900",
				"AMD FirePro V7900",
				"AMD FirePro W2100",
				"AMD FirePro W4100",
				"AMD FirePro W5100",
				"AMD FirePro W7100",
				"AMD FirePro W8100",
				"AMD FirePro W9100",
				"AMD FirePro S7150",
				"AMD FirePro S9150",
				
				// AMD Instinct (вычислительные)
				"AMD Instinct MI25",
				"AMD Instinct MI50",
				"AMD Instinct MI60",
				"AMD Instinct MI100",
				"AMD Instinct MI210",
				"AMD Instinct MI250",
				"AMD Instinct MI300"
			],
			
			variants: [
				"",
				"XT",           // eXTended (топовый вариант)
				"XTX",          // eXTended eXtreme (самый топовый)
				"GRE",          // Golden Rabbit Edition
				"XT PE",        // XT Platinum Edition
				"X2",           // Dual GPU
				"Pro",          // Professional
				"OC",           // Overclocked
				"Nitro",        // Sapphire Nitro
				"Pulse",        // Sapphire Pulse
				"Gaming",       // Gaming Edition
				"Red Devil",    // PowerColor Red Devil
				"Red Dragon",   // PowerColor Red Dragon
				"Strix",        // ASUS ROG Strix
				"TUF",          // ASUS TUF Gaming
				"Taichi",       // ASRock Taichi
				"Phantom Gaming", // ASRock Phantom Gaming
				"Gaming X",     // MSI Gaming X
				"Mech"          // MSI Mech
			],
			
			vram: [
				"128MB", "256MB", "512MB", "1GB", "2GB", 
				"3GB", "4GB", "6GB", "8GB", "12GB", 
				"16GB", "20GB", "24GB", "32GB", "48GB"
			]
		},
        intel: {
			series: [
				// Старые поколения
				"Intel i740",
				
				// GMA серии (2004-2010)
				"Intel GMA 900",
				"Intel GMA 950",
				"Intel GMA 3000",
				"Intel GMA 3100",
				"Intel GMA X3000",
				"Intel GMA X3100",
				"Intel GMA X3500",
				"Intel GMA 4500",
				"Intel GMA X4500",
				"Intel GMA HD",
				
				// HD Graphics (2010-2015, Sandy Bridge - Broadwell)
				"Intel HD Graphics",
				"Intel HD Graphics 2000",
				"Intel HD Graphics 2500",
				"Intel HD Graphics 3000",
				"Intel HD Graphics 4000",
				"Intel HD Graphics 4200",
				"Intel HD Graphics 4400",
				"Intel HD Graphics 4600",
				"Intel HD Graphics 5000",
				"Intel HD Graphics 5200",
				"Intel HD Graphics 5300",
				"Intel HD Graphics 5500",
				"Intel HD Graphics 5600",
				"Intel HD Graphics 6000",
				
				// HD Graphics (2015-2019, Skylake - Coffee Lake)
				"Intel HD Graphics 500",
				"Intel HD Graphics 505",
				"Intel HD Graphics 510",
				"Intel HD Graphics 515",
				"Intel HD Graphics 520",
				"Intel HD Graphics 530",
				"Intel HD Graphics 610",
				"Intel HD Graphics 615",
				"Intel HD Graphics 620",
				"Intel HD Graphics 630",
				
				// UHD Graphics (2017+, Kaby Lake Refresh+)
				"Intel UHD Graphics 600",
				"Intel UHD Graphics 605",
				"Intel UHD Graphics 610",
				"Intel UHD Graphics 615",
				"Intel UHD Graphics 617",
				"Intel UHD Graphics 620",
				"Intel UHD Graphics 630",
				"Intel UHD Graphics 710",
				"Intel UHD Graphics 730",
				"Intel UHD Graphics 750",
				"Intel UHD Graphics 770",
				
				// Iris/Iris Plus (2013-2020, производительные интегрированные)
				"Intel Iris Graphics 540",
				"Intel Iris Graphics 550",
				"Intel Iris Graphics 640",
				"Intel Iris Graphics 650",
				"Intel Iris Plus Graphics",
				"Intel Iris Plus Graphics 640",
				"Intel Iris Plus Graphics 645",
				"Intel Iris Plus Graphics 650",
				"Intel Iris Plus Graphics 655",
				"Intel Iris Plus Graphics G1",
				"Intel Iris Plus Graphics G4",
				"Intel Iris Plus Graphics G7",
				
				// Iris Xe (2020+, Tiger Lake+)
				"Intel Iris Xe Graphics",
				"Intel Iris Xe Graphics G7 80EU",
				"Intel Iris Xe Graphics G7 96EU",
				"Intel Iris Xe MAX",
				
				// Intel Arc (2022+, дискретные)
				"Intel Arc A310",
				"Intel Arc A350M",
				"Intel Arc A370M",
				"Intel Arc A380",
				"Intel Arc A530M",
				"Intel Arc A550M",
				"Intel Arc A570M",
				"Intel Arc A580",
				"Intel Arc A730M",
				"Intel Arc A750",
				"Intel Arc A770",
				
				// Intel Data Center GPU (вычислительные)
				"Intel Data Center GPU Flex 140",
				"Intel Data Center GPU Flex 170",
				"Intel Data Center GPU Max 1100",
				"Intel Data Center GPU Max 1550"
			],
			
			variants: [
				"",
				"Graphics",
				"Max",
				"Limited Edition",
				"ACM-G10",      // Alchemist GPU die
				"ACM-G11",
				"DG1",          // Discrete Graphics 1
				"DG2"           // Discrete Graphics 2
			],
			
			vram: [
				"64MB", "128MB", "256MB", "512MB", "1GB", 
				"2GB", "4GB", "6GB", "8GB", "12GB", "16GB", "48GB"
			]
		}
    },

    motherboard: {
        brands: ["ASUS", "ASUS ROG", "ASUS TUF", "ASUS Prime", "MSI", "MSI MAG", "MSI MPG", "MSI MEG", "Gigabyte", "Gigabyte AORUS", "ASRock", "ASRock Phantom Gaming", "ASRock Taichi", "Biostar", "EVGA", "NZXT"],
        chipsets: {
            intel: ["945G", "G31", "G41", "P45", "X58", "H55", "H61", "H67", "Z68", "H77", "Z77", "H81", "B85", "H87", "Z87", "H97", "Z97", "H110", "B150", "H170", "Z170", "B250", "H270", "Z270", "H310", "B360", "H370", "Z370", "B365", "Z390", "H410", "B460", "H470", "Z490", "B560", "H570", "Z590", "H610", "B660", "H670", "Z690", "B760", "Z790"],
            amd: ["nForce 4", "690G", "780G", "880G", "970", "990FX", "A55", "A68H", "A75", "A78", "A88X", "A320", "B350", "B450", "X370", "X470", "A520", "B550", "X570", "B650", "B650E", "X670", "X670E", "TRX40", "WRX80"]
        },
        formFactors: ["ATX", "E-ATX", "Micro-ATX", "Mini-ITX", "Mini-DTX"],
        features: ["", "WiFi", "AC", "AX", "Pro", "Ultra", "Elite", "Master", "Xtreme"]
    },

    ram: {
        brands: ["Kingston", "Kingston HyperX", "Kingston Fury", "Corsair Vengeance", "Corsair Dominator", "G.Skill Ripjaws", "G.Skill Trident Z", "Crucial", "Crucial Ballistix", "Patriot Viper", "ADATA XPG", "Team T-Force", "Thermaltake TOUGHRAM", "Samsung", "Mushkin"],
        types: ["DDR2", "DDR3", "DDR3L", "DDR4", "DDR5"],
        speeds: ["667", "800", "1066", "1333", "1600", "1866", "2133", "2400", "2666", "2933", "3000", "3200", "3600", "4000", "4400", "4800", "5200", "5600", "6000", "6400", "6800", "7200"],
        sizes: ["512MB", "1GB", "2GB", "4GB", "8GB", "16GB", "32GB", "64GB"],
        latencies: ["CL14", "CL15", "CL16", "CL17", "CL18", "CL19", "CL20", "CL30", "CL32", "CL34", "CL36", "CL38", "CL40"]
    },

    storage: {
        hdd: {
            brands: ["WD Blue", "WD Black", "WD Red", "WD Purple", "Seagate Barracuda", "Seagate IronWolf", "Seagate FireCuda", "Toshiba P300", "Toshiba X300", "Hitachi Deskstar", "HGST Ultrastar"],
            capacities: ["80GB", "120GB", "160GB", "250GB", "320GB", "500GB", "640GB", "750GB", "1TB", "2TB", "3TB", "4TB", "6TB", "8TB", "10TB", "12TB", "14TB", "16TB", "18TB", "20TB"],
            speeds: ["5400RPM", "7200RPM", "10000RPM"],
            cache: ["8MB", "16MB", "32MB", "64MB", "128MB", "256MB"]
        },
        ssd: {
            brands: ["Samsung", "Samsung EVO", "Samsung PRO", "Crucial MX", "Crucial BX", "WD Blue", "WD Black", "Kingston A", "Kingston KC", "SanDisk", "Intel", "Corsair", "ADATA", "Patriot", "PNY", "Mushkin", "Sabrent", "SK hynix"],
            types: ["SATA III", "M.2 SATA", "M.2 NVMe PCIe 3.0", "M.2 NVMe PCIe 4.0", "M.2 NVMe PCIe 5.0"],
            capacities: ["120GB", "128GB", "240GB", "250GB", "256GB", "480GB", "500GB", "512GB", "960GB", "1TB", "2TB", "4TB", "8TB"],
            models: ["860", "870", "970", "980", "990", "500", "2000", "3000", "400", "BX500", "MX500", "P1", "P2", "P3", "P5", "SN550", "SN750", "SN770", "SN850"]
        }
    },

    peripherals: {
        mouse: {
            brands: ["Logitech", "Razer", "SteelSeries", "Corsair", "HyperX", "Cooler Master", "ASUS ROG", "Glorious", "Zowie", "Roccat", "MSI"],
            models: ["G102", "G203", "G305", "G403", "G502", "G703", "G Pro", "DeathAdder", "Viper", "Basilisk", "Naga", "Rival", "Sensei", "Aerox", "Dark Core", "Ironclaw", "Scimitar", "Model O", "Model D", "EC2", "FK2", "S2"],
            sensors: ["3325", "3360", "3389", "3395", "HERO 16K", "HERO 25K", "Focus+", "TrueMove3", "TrueMove Air", "PixArt"],
            dpi: ["800", "1600", "3200", "6400", "8000", "12000", "16000", "20000", "25600", "30000"],
            types: ["Wired", "Wireless", "Wireless RGB"]
        },
        keyboard: {
            brands: ["Corsair", "Logitech", "Razer", "SteelSeries", "HyperX", "Ducky", "Keychron", "ASUS ROG", "Cooler Master", "MSI", "Leopold", "Varmilo"],
            models: ["K70", "K95", "K100", "G413", "G513", "G915", "G Pro X", "BlackWidow", "Huntsman", "Cynosa", "Apex", "Apex Pro", "Alloy", "Origins", "One 2", "One 3", "Shine", "K2", "K6", "K8", "Q1", "Q2"],
            switches: ["Cherry MX Red", "Cherry MX Blue", "Cherry MX Brown", "Cherry MX Silver", "Cherry MX Black", "Gateron Red", "Gateron Blue", "Gateron Brown", "Razer Green", "Razer Yellow", "Razer Orange", "Kailh Box White", "Kailh Speed Silver"],
            sizes: ["Full-size", "TKL", "75%", "65%", "60%"],
            types: ["Wired", "Wireless", "Bluetooth"]
        },
        monitor: {
            brands: ["ASUS", "ASUS ROG", "ASUS TUF", "LG", "LG UltraGear", "Samsung", "Samsung Odyssey", "AOC", "AOC AGON", "BenQ", "BenQ ZOWIE", "MSI", "Acer", "Acer Predator", "Dell", "ViewSonic", "Gigabyte", "Alienware"],
            sizes: ["21.5", "23.8", "24", "24.5", "27", "28", "31.5", "32", "34", "35", "38", "43", "49"],
            resolutions: ["1920x1080", "2560x1080", "2560x1440", "3440x1440", "3840x1600", "3840x2160", "5120x1440", "7680x4320"],
            refreshRates: ["60Hz", "75Hz", "100Hz", "120Hz", "144Hz", "165Hz", "180Hz", "200Hz", "240Hz", "280Hz", "360Hz", "500Hz"],
            panels: ["TN", "IPS", "VA", "OLED", "Mini-LED", "Nano-IPS", "Fast IPS"],
            features: ["", "G-Sync", "FreeSync", "G-Sync Compatible", "HDR400", "HDR600", "HDR1000"]
        },
        headset: {
            brands: ["HyperX", "SteelSeries", "Logitech", "Razer", "Corsair", "ASUS ROG", "Cooler Master", "Sennheiser", "Audio-Technica", "Beyerdynamic", "Sony", "JBL"],
            models: ["Cloud", "Cloud II", "Cloud Alpha", "Cloud Flight", "Arctis 1", "Arctis 3", "Arctis 5", "Arctis 7", "Arctis 9", "Arctis Pro", "G433", "G533", "G733", "G Pro X", "Kraken", "BlackShark", "Barracuda", "Void", "HS60", "HS70", "Virtuoso"],
            types: ["Wired", "Wireless", "Wireless 2.4GHz", "Bluetooth"],
            drivers: ["40mm", "50mm", "53mm"],
            features: ["", "7.1", "Surround", "RGB", "Noise Cancelling", "Detachable Mic"]
        },
        psu: {
            brands: ["Corsair", "EVGA", "Seasonic", "Thermaltake", "Cooler Master", "be quiet!", "FSP", "Antec", "XPG", "MSI", "NZXT", "Silverstone"],
            series: ["RM", "RMx", "RMi", "HX", "AX", "SF", "CX", "CV", "VS", "SuperNOVA", "G6", "G7", "GT", "P2", "T2", "Focus", "Prime", "Core", "Toughpower", "Smart", "MWE", "V", "SFX", "Straight Power", "Pure Power", "Dark Power"],
            wattages: ["300W", "400W", "450W", "500W", "550W", "600W", "650W", "700W", "750W", "800W", "850W", "1000W", "1200W", "1300W", "1500W", "1600W"],
            ratings: ["80+ White", "80+ Bronze", "80+ Silver", "80+ Gold", "80+ Platinum", "80+ Titanium"],
            modular: ["Non-Modular", "Semi-Modular", "Fully Modular"]
        },
        cooling: {
            brands: ["Noctua", "be quiet!", "Cooler Master", "Arctic", "DeepCool", "Corsair", "NZXT", "Thermaltake", "Scythe", "Cryorig", "ID-Cooling", "Zalman"],
            types: ["Tower", "Low-Profile", "AIO 120mm", "AIO 240mm", "AIO 280mm", "AIO 360mm", "AIO 420mm"],
            models: ["NH-D15", "NH-U12S", "NH-L9", "Dark Rock 4", "Dark Rock Pro 4", "Shadow Rock", "Hyper 212", "MasterLiquid", "Freezer", "AK400", "AK620", "H60", "H100", "H115", "H150", "Kraken X53", "Kraken Z63", "Kraken X73", "Floe"],
            fans: ["92mm", "120mm", "140mm"],
            rpm: ["800-1500", "1000-1800", "1200-2000", "1500-2500"]
        },
        case: {
            brands: ["Corsair", "NZXT", "Fractal Design", "Lian Li", "Cooler Master", "be quiet!", "Phanteks", "Thermaltake", "Silverstone", "Antec"],
            models: ["4000D", "5000D", "H510", "H710", "Meshify C", "Meshify 2", "Define 7", "O11 Dynamic", "PC-O11", "MasterBox", "TD500", "Pure Base", "Silent Base", "P400A", "P500A", "View 51"],
            sizes: ["Mini-ITX", "Micro-ATX", "Mid-Tower", "Full-Tower"],
            features: ["", "Airflow", "RGB", "Tempered Glass", "Mesh Front"]
        }
    }
};

/**
 * УТИЛИТЫ КОДИРОВАНИЯ
 */
const EncodingUtils = {
    /**
     * Кодирует массив индексов в одно число используя смешанные основания
     * @param {number[]} indices - Массив индексов
     * @param {number[]} bases - Массив размеров для каждого измерения
     * @returns {number} Закодированное число
     */
    encodeMultiDimensional: (indices, bases) => {
        let result = 0;
        let multiplier = 1;
        
        for (let i = indices.length - 1; i >= 0; i--) {
            result += indices[i] * multiplier;
            multiplier *= bases[i];
        }
        
        return result;
    },

    /**
     * Декодирует число обратно в массив индексов
     * @param {number} encoded - Закодированное число
     * @param {number[]} bases - Массив размеров для каждого измерения
     * @returns {number[]} Массив индексов
     */
    decodeMultiDimensional: (encoded, bases) => {
        const indices = [];
        let remaining = encoded;
        
        for (let i = bases.length - 1; i >= 0; i--) {
            indices[i] = remaining % bases[i];
            remaining = Math.floor(remaining / bases[i]);
        }
        
        return indices;
    },

    /**
     * Добавляет контрольную сумму к числу
     */
    addChecksum: (value) => {
        const checksum = value % 97;
        return value * 100 + checksum;
    },

    /**
     * Проверяет и удаляет контрольную сумму
     */
    verifyChecksum: (value) => {
        const checksum = value % 100;
        const original = Math.floor(value / 100);
        return original % 97 === checksum ? original : null;
    },

    /**
     * Конвертирует число в base36 для компактности
     */
    toBase36: (num) => num.toString(36).toUpperCase(),
    
    /**
     * Парсит из base36
     */
    fromBase36: (str) => parseInt(str, 36)
};

/**
 * ГЕНЕРАТОРЫ КОМПЛЕКТУЮЩИХ
 */
const ComponentGenerator = {
    /**
     * Генерирует процессор с встроенным payload
     * Формат: Brand-Model[Suffix] [Speed]GHz [XM-CODE]
     */
   generateCPU: (payload) => {
        const vendor = payload % 2 === 0 ? 'intel' : 'amd';
        const dict = dictionaries.cpu[vendor];
        
        const brandIdx = payload % dict.brands.length;
        const brand = dict.brands[brandIdx];
        
        // Определяем тип модели по бренду
        let modelType = 'modern';
        let modelArray = dict.models.modern;
        
        if (brand.includes('Core 2 Duo')) {
            modelType = 'core2duo';
            modelArray = dict.models.core2duo;
        } else if (brand.includes('Core 2 Quad')) {
            modelType = 'core2quad';
            modelArray = dict.models.core2quad;
        } else if (brand.includes('Athlon 64 X2')) {
            modelType = 'athlon64x2';
            modelArray = dict.models.athlon64x2;
        } else if (brand.includes('Phenom II')) {
            modelType = 'phenomii';
            modelArray = dict.models.phenomii;
        }
        
        const modelIdx = Math.floor(payload / dict.brands.length) % modelArray.length;
        const model = modelArray[modelIdx];
        
        const suffixIdx = Math.floor(payload / (dict.brands.length * modelArray.length)) % dict.suffixes.length;
        const suffix = dict.suffixes[suffixIdx];
        
        const speedIdx = Math.floor(payload / (dict.brands.length * modelArray.length * dict.suffixes.length)) % dict.speeds.length;
        const speed = dict.speeds[speedIdx];
        
        // Кодирование
        const bases = [dict.brands.length, modelArray.length, dict.suffixes.length, dict.speeds.length];
        const indices = [brandIdx, modelIdx, suffixIdx, speedIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        // Формирование имени
        let fullModel;
        
        if (brand.includes('xxx')) {
            // Современный формат: i5-12xxx → i5-12600
            fullModel = brand.replace('xxx', model);
        } else if (brand.includes('Core 2') || brand.includes('Phenom II') || brand.includes('Athlon 64 X2')) {
            // Старый формат: Core 2 Duo E8400
            fullModel = `${brand} ${model}`;
        } else {
            // Общий формат
            fullModel = `${brand}-${model}`;
        }
        
        // Суффикс только для современных процессоров
        const finalSuffix = (modelType === 'modern' && suffix) ? suffix : '';
        
        return `${fullModel}${finalSuffix} ${speed}GHz XM-${code}`;
    },

    /**
     * Генерирует видеокарту
     * Формат: Brand Series-Model [Variant] [VRAM] REV-CODE
     */
    generateGPU: (payload) => {
        const vendors = ['nvidia', 'amd', 'intel'];
        const vendorIdx = payload % vendors.length;
        const vendor = vendors[vendorIdx];
        const dict = dictionaries.gpu[vendor];
        
        const seriesIdx = Math.floor(payload / vendors.length) % dict.series.length;
        const modelIdx = Math.floor(payload / (vendors.length * dict.series.length)) % dict.models.length;
        const variantIdx = Math.floor(payload / (vendors.length * dict.series.length * dict.models.length)) % dict.variants.length;
        const vramIdx = Math.floor(payload / (vendors.length * dict.series.length * dict.models.length * dict.variants.length)) % dict.vram.length;
        
        const bases = [vendors.length, dict.series.length, dict.models.length, dict.variants.length, dict.vram.length];
        const indices = [vendorIdx, seriesIdx, modelIdx, variantIdx, vramIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        const series = dict.series[seriesIdx];
        const model = dict.models[modelIdx];
        const variant = dict.variants[variantIdx];
        const vram = dict.vram[vramIdx];
        
        const fullModel = series.includes('xxx') ? series.replace('xxx', model) : `${series} ${model}`;
        
        return `${fullModel} ${variant} ${vram} REV-${code}`.replace(/\s+/g, ' ').trim();
    },

    /**
     * Генерирует материнскую плату
     * Формат: Brand Chipset [Feature] [FormFactor] MOD-CODE
     */
    generateMotherboard: (payload) => {
        const brandIdx = payload % dictionaries.motherboard.brands.length;
        const brand = dictionaries.motherboard.brands[brandIdx];
        
        // Определяем Intel/AMD по payload
        const isIntel = (payload >> 4) % 2 === 0;
        const chipsetDict = isIntel ? dictionaries.motherboard.chipsets.intel : dictionaries.motherboard.chipsets.amd;
        
        const chipsetIdx = Math.floor(payload / dictionaries.motherboard.brands.length) % chipsetDict.length;
        const formIdx = Math.floor(payload / (dictionaries.motherboard.brands.length * chipsetDict.length)) % dictionaries.motherboard.formFactors.length;
        const featureIdx = Math.floor(payload / (dictionaries.motherboard.brands.length * chipsetDict.length * dictionaries.motherboard.formFactors.length)) % dictionaries.motherboard.features.length;
        
        const bases = [dictionaries.motherboard.brands.length, chipsetDict.length, dictionaries.motherboard.formFactors.length, dictionaries.motherboard.features.length, 2];
        const indices = [brandIdx, chipsetIdx, formIdx, featureIdx, isIntel ? 1 : 0];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        const chipset = chipsetDict[chipsetIdx];
        const form = dictionaries.motherboard.formFactors[formIdx];
        const feature = dictionaries.motherboard.features[featureIdx];
        
        return `${brand} ${chipset} ${feature} ${form} MOD-${code}`.replace(/\s+/g, ' ').trim();
    },

    /**
     * Генерирует оперативную память
     * Формат: Brand Type Size Speed [Latency] PN-CODE
     */
    generateRAM: (payload) => {
        const dict = dictionaries.ram;
        
        const brandIdx = payload % dict.brands.length;
        const typeIdx = Math.floor(payload / dict.brands.length) % dict.types.length;
        const sizeIdx = Math.floor(payload / (dict.brands.length * dict.types.length)) % dict.sizes.length;
        const speedIdx = Math.floor(payload / (dict.brands.length * dict.types.length * dict.sizes.length)) % dict.speeds.length;
        const latencyIdx = Math.floor(payload / (dict.brands.length * dict.types.length * dict.sizes.length * dict.speeds.length)) % dict.latencies.length;
        
        const bases = [dict.brands.length, dict.types.length, dict.sizes.length, dict.speeds.length, dict.latencies.length];
        const indices = [brandIdx, typeIdx, sizeIdx, speedIdx, latencyIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.types[typeIdx]}-${dict.speeds[speedIdx]} ${dict.sizes[sizeIdx]} ${dict.latencies[latencyIdx]} PN-${code}`;
    },

    /**
     * Генерирует накопитель (HDD/SSD)
     * Формат: Brand Type Capacity [Model] SN:CODE
     */
    generateStorage: (payload) => {
        const isHDD = payload % 2 === 0;
        const dict = isHDD ? dictionaries.storage.hdd : dictionaries.storage.ssd;
        
        const brandIdx = Math.floor(payload / 2) % dict.brands.length;
        const capacityIdx = Math.floor(payload / (2 * dict.brands.length)) % dict.capacities.length;
        
        let type, typeIdx, modelIdx, model = '';
        
        if (isHDD) {
            typeIdx = Math.floor(payload / (2 * dict.brands.length * dict.capacities.length)) % dict.speeds.length;
            const cacheIdx = Math.floor(payload / (2 * dict.brands.length * dict.capacities.length * dict.speeds.length)) % dict.cache.length;
            type = `${dict.speeds[typeIdx]} ${dict.cache[cacheIdx]} Cache`;
            
            const bases = [2, dict.brands.length, dict.capacities.length, dict.speeds.length, dict.cache.length];
            const indices = [0, brandIdx, capacityIdx, typeIdx, cacheIdx];
            const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
            const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
            const code = EncodingUtils.toBase36(withChecksum);
            
            return `${dict.brands[brandIdx]} ${dict.capacities[capacityIdx]} HDD ${type} SN:${code}`;
        } else {
            typeIdx = Math.floor(payload / (2 * dict.brands.length * dict.capacities.length)) % dict.types.length;
            modelIdx = Math.floor(payload / (2 * dict.brands.length * dict.capacities.length * dict.types.length)) % dict.models.length;
            type = dict.types[typeIdx];
            model = dict.models[modelIdx];
            
            const bases = [2, dict.brands.length, dict.capacities.length, dict.types.length, dict.models.length];
            const indices = [1, brandIdx, capacityIdx, typeIdx, modelIdx];
            const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
            const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
            const code = EncodingUtils.toBase36(withChecksum);
            
            return `${dict.brands[brandIdx]} ${model} ${dict.capacities[capacityIdx]} ${type} SN:${code}`;
        }
    },

    /**
     * Генерирует мышь
     * Формат: Brand Model [DPI] [Type] MN-CODE
     */
    generateMouse: (payload) => {
        const dict = dictionaries.peripherals.mouse;
        
        const brandIdx = payload % dict.brands.length;
        const modelIdx = Math.floor(payload / dict.brands.length) % dict.models.length;
        const sensorIdx = Math.floor(payload / (dict.brands.length * dict.models.length)) % dict.sensors.length;
        const dpiIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.sensors.length)) % dict.dpi.length;
        const typeIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.sensors.length * dict.dpi.length)) % dict.types.length;
        
        const bases = [dict.brands.length, dict.models.length, dict.sensors.length, dict.dpi.length, dict.types.length];
        const indices = [brandIdx, modelIdx, sensorIdx, dpiIdx, typeIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.models[modelIdx]} ${dict.types[typeIdx]} ${dict.dpi[dpiIdx]}DPI ${dict.sensors[sensorIdx]} MN-${code}`;
    },

    /**
     * Генерирует клавиатуру
     * Формат: Brand Model [Switches] [Size] [Type] KB-CODE
     */
    generateKeyboard: (payload) => {
        const dict = dictionaries.peripherals.keyboard;
        
        const brandIdx = payload % dict.brands.length;
        const modelIdx = Math.floor(payload / dict.brands.length) % dict.models.length;
        const switchIdx = Math.floor(payload / (dict.brands.length * dict.models.length)) % dict.switches.length;
        const sizeIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.switches.length)) % dict.sizes.length;
        const typeIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.switches.length * dict.sizes.length)) % dict.types.length;
        
        const bases = [dict.brands.length, dict.models.length, dict.switches.length, dict.sizes.length, dict.types.length];
        const indices = [brandIdx, modelIdx, switchIdx, sizeIdx, typeIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.models[modelIdx]} ${dict.switches[switchIdx]} ${dict.sizes[sizeIdx]} ${dict.types[typeIdx]} KB-${code}`;
    },

    /**
     * Генерирует монитор
     * Формат: Brand Size Resolution RefreshRate Panel [Feature] MR-CODE
     */
    generateMonitor: (payload) => {
        const dict = dictionaries.peripherals.monitor;
        
        const brandIdx = payload % dict.brands.length;
        const sizeIdx = Math.floor(payload / dict.brands.length) % dict.sizes.length;
        const resIdx = Math.floor(payload / (dict.brands.length * dict.sizes.length)) % dict.resolutions.length;
        const refreshIdx = Math.floor(payload / (dict.brands.length * dict.sizes.length * dict.resolutions.length)) % dict.refreshRates.length;
        const panelIdx = Math.floor(payload / (dict.brands.length * dict.sizes.length * dict.resolutions.length * dict.refreshRates.length)) % dict.panels.length;
        const featureIdx = Math.floor(payload / (dict.brands.length * dict.sizes.length * dict.resolutions.length * dict.refreshRates.length * dict.panels.length)) % dict.features.length;
        
        const bases = [dict.brands.length, dict.sizes.length, dict.resolutions.length, dict.refreshRates.length, dict.panels.length, dict.features.length];
        const indices = [brandIdx, sizeIdx, resIdx, refreshIdx, panelIdx, featureIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.sizes[sizeIdx]}" ${dict.resolutions[resIdx]} ${dict.refreshRates[refreshIdx]} ${dict.panels[panelIdx]} ${dict.features[featureIdx]} MR-${code}`.replace(/\s+/g, ' ').trim();
    },

    /**
     * Генерирует наушники
     * Формат: Brand Model [Type] [Driver] [Feature] HS-CODE
     */
    generateHeadset: (payload) => {
        const dict = dictionaries.peripherals.headset;
        
        const brandIdx = payload % dict.brands.length;
        const modelIdx = Math.floor(payload / dict.brands.length) % dict.models.length;
        const typeIdx = Math.floor(payload / (dict.brands.length * dict.models.length)) % dict.types.length;
        const driverIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.types.length)) % dict.drivers.length;
        const featureIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.types.length * dict.drivers.length)) % dict.features.length;
        
        const bases = [dict.brands.length, dict.models.length, dict.types.length, dict.drivers.length, dict.features.length];
        const indices = [brandIdx, modelIdx, typeIdx, driverIdx, featureIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.models[modelIdx]} ${dict.types[typeIdx]} ${dict.drivers[driverIdx]} ${dict.features[featureIdx]} HS-${code}`.replace(/\s+/g, ' ').trim();
    },

    /**
     * Генерирует блок питания
     * Формат: Brand Series Wattage Rating Modular PSU-CODE
     */
    generatePSU: (payload) => {
        const dict = dictionaries.peripherals.psu;
        
        const brandIdx = payload % dict.brands.length;
        const seriesIdx = Math.floor(payload / dict.brands.length) % dict.series.length;
        const wattageIdx = Math.floor(payload / (dict.brands.length * dict.series.length)) % dict.wattages.length;
        const ratingIdx = Math.floor(payload / (dict.brands.length * dict.series.length * dict.wattages.length)) % dict.ratings.length;
        const modularIdx = Math.floor(payload / (dict.brands.length * dict.series.length * dict.wattages.length * dict.ratings.length)) % dict.modular.length;
        
        const bases = [dict.brands.length, dict.series.length, dict.wattages.length, dict.ratings.length, dict.modular.length];
        const indices = [brandIdx, seriesIdx, wattageIdx, ratingIdx, modularIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.series[seriesIdx]} ${dict.wattages[wattageIdx]} ${dict.ratings[ratingIdx]} ${dict.modular[modularIdx]} PSU-${code}`;
    },

    /**
     * Генерирует систему охлаждения
     * Формат: Brand Model Type [Fans] [RPM] CL-CODE
     */
    generateCooling: (payload) => {
        const dict = dictionaries.peripherals.cooling;
        
        const brandIdx = payload % dict.brands.length;
        const modelIdx = Math.floor(payload / dict.brands.length) % dict.models.length;
        const typeIdx = Math.floor(payload / (dict.brands.length * dict.models.length)) % dict.types.length;
        const fanIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.types.length)) % dict.fans.length;
        const rpmIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.types.length * dict.fans.length)) % dict.rpm.length;
        
        const bases = [dict.brands.length, dict.models.length, dict.types.length, dict.fans.length, dict.rpm.length];
        const indices = [brandIdx, modelIdx, typeIdx, fanIdx, rpmIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.models[modelIdx]} ${dict.types[typeIdx]} ${dict.fans[fanIdx]} ${dict.rpm[rpmIdx]}RPM CL-${code}`;
    },

    /**
     * Генерирует корпус
     * Формат: Brand Model Size [Feature] CS-CODE
     */
    generateCase: (payload) => {
        const dict = dictionaries.peripherals.case;
        
        const brandIdx = payload % dict.brands.length;
        const modelIdx = Math.floor(payload / dict.brands.length) % dict.models.length;
        const sizeIdx = Math.floor(payload / (dict.brands.length * dict.models.length)) % dict.sizes.length;
        const featureIdx = Math.floor(payload / (dict.brands.length * dict.models.length * dict.sizes.length)) % dict.features.length;
        
        const bases = [dict.brands.length, dict.models.length, dict.sizes.length, dict.features.length];
        const indices = [brandIdx, modelIdx, sizeIdx, featureIdx];
        const encoded = EncodingUtils.encodeMultiDimensional(indices, bases);
        const withChecksum = EncodingUtils.addChecksum(encoded ^ payload);
        const code = EncodingUtils.toBase36(withChecksum);
        
        return `${dict.brands[brandIdx]} ${dict.models[modelIdx]} ${dict.sizes[sizeIdx]} ${dict.features[featureIdx]} CS-${code}`.replace(/\s+/g, ' ').trim();
    }
};

/**
 * ПАРСЕР КОМПЛЕКТУЮЩИХ
 */
const ComponentParser = {
    /**
     * Маркеры для разных типов комплектующих
     */
    markers: {
        cpu: /XM-([A-Z0-9]+)/,
        gpu: /REV-([A-Z0-9]+)/,
        motherboard: /MOD-([A-Z0-9]+)/,
        ram: /PN-([A-Z0-9]+)/,
        storage: /SN:([A-Z0-9]+)/,
        mouse: /MN-([A-Z0-9]+)/,
        keyboard: /KB-([A-Z0-9]+)/,
        monitor: /MR-([A-Z0-9]+)/,
        headset: /HS-([A-Z0-9]+)/,
        psu: /PSU-([A-Z0-9]+)/,
        cooling: /CL-([A-Z0-9]+)/,
        case: /CS-([A-Z0-9]+)/
    },

    /**
     * Паттерны для определения типа комплектующего
     * Ищем полную строку компонента, а не просто упоминание бренда
     */
    patterns: {
        cpu: /(?:Intel|AMD)\s+(?:Core|Ryzen|Pentium|Celeron|Xeon|Athlon|Phenom|FX|Threadripper|EPYC)[^\n]*?XM-[A-Z0-9]+/gi,
        gpu: /(?:NVIDIA|GeForce|ATI|AMD\s+Radeon|Intel\s+(?:GMA|HD|UHD|Iris|Arc))[^\n]*?REV-[A-Z0-9]+/gi,
        motherboard: /(?:ASUS|MSI|Gigabyte|ASRock|Biostar|EVGA|NZXT)[^\n]*?MOD-[A-Z0-9]+/gi,
        ram: /(?:Kingston|Corsair|G\.Skill|Crucial|Patriot|ADATA|Team|Thermaltake|Samsung|Mushkin)[^\n]*?PN-[A-Z0-9]+/gi,
        storage: /(?:Samsung|WD|Seagate|Toshiba|Hitachi|HGST|Kingston|Crucial|SanDisk|Intel|Corsair|ADATA|Patriot|PNY|Mushkin|Sabrent|SK\s+hynix)[^\n]*?SN:[A-Z0-9]+/gi,
        mouse: /(?:Logitech|Razer|SteelSeries|Corsair|HyperX|Cooler\s+Master|ASUS|Glorious|Zowie|Roccat|MSI)[^\n]*?MN-[A-Z0-9]+/gi,
        keyboard: /(?:Corsair|Logitech|Razer|SteelSeries|HyperX|Ducky|Keychron|ASUS|Cooler\s+Master|MSI|Leopold|Varmilo)[^\n]*?KB-[A-Z0-9]+/gi,
        monitor: /(?:ASUS|LG|Samsung|AOC|BenQ|MSI|Acer|Dell|ViewSonic|Gigabyte|Alienware)[^\n]*?MR-[A-Z0-9]+/gi,
        headset: /(?:HyperX|SteelSeries|Logitech|Razer|Corsair|ASUS|Cooler\s+Master|Sennheiser|Audio-Technica|Beyerdynamic|Sony|JBL)[^\n]*?HS-[A-Z0-9]+/gi,
        psu: /(?:Corsair|EVGA|Seasonic|Thermaltake|Cooler\s+Master|be\s+quiet!|FSP|Antec|XPG|MSI|NZXT|Silverstone)[^\n]*?PSU-[A-Z0-9]+/gi,
        cooling: /(?:Noctua|be\s+quiet!|Cooler\s+Master|Arctic|DeepCool|Corsair|NZXT|Thermaltake|Scythe|Cryorig|ID-Cooling|Zalman)[^\n]*?CL-[A-Z0-9]+/gi,
        case: /(?:Corsair|NZXT|Fractal\s+Design|Lian\s+Li|Cooler\s+Master|be\s+quiet!|Phanteks|Thermaltake|Silverstone|Antec)[^\n]*?CS-[A-Z0-9]+/gi
    },

    /**
     * Извлекает payload из названия компонента
     */
    extractPayload: (componentText, type) => {
        const marker = ComponentParser.markers[type];
        const match = componentText.match(marker);
        
        if (!match) return null;
        
        const code = match[1];
        const encoded = EncodingUtils.fromBase36(code);
        const verified = EncodingUtils.verifyChecksum(encoded);
        
        if (verified === null) return null; // Неверная контрольная сумма
        
        // Теперь нужно декодировать обратно, но для этого нужны bases
        // Это зависит от типа компонента
        return {
            encoded: verified,
            code: code,
            type: type,
            fullText: componentText
        };
    },

    /**
     * Декодирует CPU
     */
    decodeCPU: (encoded, originalPayload) => {
        const payload = encoded ^ originalPayload;
        const vendor = payload % 2 === 0 ? 'intel' : 'amd';
        const dict = dictionaries.cpu[vendor];
        
        const bases = [dict.brands.length, dict.models.length, dict.suffixes.length, dict.speeds.length];
        const indices = EncodingUtils.decodeMultiDimensional(encoded, bases);
        
        return {
            vendor: vendor,
            brand: dict.brands[indices[0]],
            model: dict.models[indices[1]],
            suffix: dict.suffixes[indices[2]],
            speed: dict.speeds[indices[3]],
            payload: payload
        };
    },

    /**
     * Находит все компоненты в тексте
     */
    findAllComponents: (text) => {
        const found = {};
        
        for (const [type, pattern] of Object.entries(ComponentParser.patterns)) {
            const matches = [...text.matchAll(pattern)];
            found[type] = matches.map(m => m[0]);
        }
        
        return found;
    },

    /**
     * Заменяет самописные наименования на процедурно-сгенерированные
     * Ищет паттерны и заменяет их на новые с тем же payload
     */
    replaceComponents: (text, payloadGenerator = (i) => i) => {
        let result = text;
        let componentIndex = 0;
        
        for (const [type, pattern] of Object.entries(ComponentParser.patterns)) {
            result = result.replace(pattern, (match) => {
                const extracted = ComponentParser.extractPayload(match, type);
                
                if (!extracted) return match; // Если не удалось извлечь, оставляем как есть
                
                // Генерируем новый компонент с извлечённым payload
                const generatorName = 'generate' + type.charAt(0).toUpperCase() + type.slice(1);
                const generator = ComponentGenerator[generatorName];
                
                if (!generator) return match;
                
                const newPayload = payloadGenerator(extracted.encoded, componentIndex++, type);
                return generator(newPayload);
            });
        }
        
        return result;
    }
};

/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
 */

// Генерация компонентов с разными payload
console.log("=== ПРОЦЕССОРЫ ===");
console.log(ComponentGenerator.generateCPU(12345));
console.log(ComponentGenerator.generateCPU(67890));
console.log(ComponentGenerator.generateCPU(111213));

console.log("\n=== ВИДЕОКАРТЫ ===");
console.log(ComponentGenerator.generateGPU(42));
console.log(ComponentGenerator.generateGPU(1337));
console.log(ComponentGenerator.generateGPU(99999));

console.log("\n=== МАТЕРИНСКИЕ ПЛАТЫ ===");
console.log(ComponentGenerator.generateMotherboard(555));
console.log(ComponentGenerator.generateMotherboard(777));

console.log("\n=== ОПЕРАТИВНАЯ ПАМЯТЬ ===");
console.log(ComponentGenerator.generateRAM(888));
console.log(ComponentGenerator.generateRAM(999));

console.log("\n=== НАКОПИТЕЛИ ===");
console.log(ComponentGenerator.generateStorage(1000));
console.log(ComponentGenerator.generateStorage(2001));

console.log("\n=== ПЕРИФЕРИЯ ===");
console.log(ComponentGenerator.generateMouse(123));
console.log(ComponentGenerator.generateKeyboard(456));
console.log(ComponentGenerator.generateMonitor(789));
console.log(ComponentGenerator.generateHeadset(321));
console.log(ComponentGenerator.generatePSU(654));
console.log(ComponentGenerator.generateCooling(987));
console.log(ComponentGenerator.generateCase(147));

// Парсинг текста
console.log("\n=== ПАРСИНГ ТЕКСТА ===");
const testText = `
Мой новый ПК:
- Процессор: ${ComponentGenerator.generateCPU(12345)}
- Видеокарта: ${ComponentGenerator.generateGPU(67890)}
- Материнская плата: ${ComponentGenerator.generateMotherboard(555)}
- ОЗУ: ${ComponentGenerator.generateRAM(888)}
- SSD: ${ComponentGenerator.generateStorage(2001)}
- Мышь: ${ComponentGenerator.generateMouse(123)}
- Клавиатура: ${ComponentGenerator.generateKeyboard(456)}
- Монитор: ${ComponentGenerator.generateMonitor(789)}
- Наушники: ${ComponentGenerator.generateHeadset(321)}
- БП: ${ComponentGenerator.generatePSU(654)}
- Охлаждение: ${ComponentGenerator.generateCooling(987)}
- Корпус: ${ComponentGenerator.generateCase(147)}

Обратите внимание, что простое упоминание Intel или AMD не считается компонентом.
Также NVIDIA сама по себе не является видеокартой.
`;

console.log("Исходный текст:", testText);

const foundComponents = ComponentParser.findAllComponents(testText);
console.log("\nНайденные компоненты:", foundComponents);

// Замена компонентов
console.log("\n=== ЗАМЕНА КОМПОНЕНТОВ ===");
const replacedText = ComponentParser.replaceComponents(testText, (payload, index) => {
    // Можно модифицировать payload или оставить как есть
    return payload + index; // Добавляем индекс для демонстрации
});
console.log("Текст после замены:", replacedText);

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        dictionaries,
        EncodingUtils,
        ComponentGenerator,
        ComponentParser
    };
}