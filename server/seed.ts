import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(sql: string, params: any[] = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function seedNewGameTypes() {
  try {
    const existing = await q("SELECT COUNT(*) as count FROM levels WHERE name = 'SAD Speed Round'");
    if (Number(existing[0].count) > 0) return;
  } catch (e) { return; }

  console.log("[IKUGAMES] Seeding new game type levels...");

  const topics = await q("SELECT id, name FROM topics ORDER BY order_index ASC");
  if (topics.length < 6) return;

  const [sadId, progId, dsId, dbId, netId, seId] = topics.map((t: any) => t.id);

  async function createLevel(topicId: string, levelNum: number, name: string, gameType: string, xpR: number, coinR: number, diff: string) {
    const [l] = await q(
      "INSERT INTO levels (topic_id, level_number, name, game_type, xp_reward, coin_reward, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [topicId, levelNum, name, gameType, xpR, coinR, diff]
    );
    return l.id as string;
  }

  async function addBlitzQuestions(levelId: string, items: { content: string; answer: string; choices: string[]; hint?: string }[]) {
    for (let i = 0; i < items.length; i++) {
      const opts = JSON.stringify({ choices: items[i].choices });
      await q(
        "INSERT INTO questions (level_id, content, answer, options, hint, order_index) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",
        [levelId, items[i].content, items[i].answer, opts, items[i].hint || "", i]
      );
    }
  }

  async function addBubbleQuestions(levelId: string, items: { content: string; answer: string; choices: string[] }[]) {
    for (let i = 0; i < items.length; i++) {
      const opts = JSON.stringify({ choices: items[i].choices });
      await q(
        "INSERT INTO questions (level_id, content, answer, options, order_index) VALUES ($1,$2,$3,$4::jsonb,$5)",
        [levelId, items[i].content, items[i].answer, opts, i]
      );
    }
  }

  async function addMemoryPairs(levelId: string, pairs: { term: string; definition: string }[]) {
    const optsJson = JSON.stringify({ pairs });
    for (let i = 0; i < pairs.length; i++) {
      await q(
        "INSERT INTO questions (level_id, content, answer, options, order_index) VALUES ($1,$2,$3,$4::jsonb,$5)",
        [levelId, pairs[i].term, pairs[i].definition, optsJson, i]
      );
    }
  }

  // ===== SYSTEM ANALYSIS & DESIGN =====
  const sadBlitz = await createLevel(sadId, 4, "SAD Speed Round", "speed_blitz", 80, 22, "medium");
  await addBlitzQuestions(sadBlitz, [
    { content: "Which diagram shows interactions between users and the system?", answer: "Use Case Diagram", choices: ["ER Diagram", "Use Case Diagram", "Sequence Diagram", "Gantt Chart"], hint: "UML behavioral diagram" },
    { content: "What does SDLC stand for?", answer: "Software Development Life Cycle", choices: ["Software Design Logic Construct", "Software Development Life Cycle", "System Data Layer Component", "Structured Development Layout Chart"], hint: "A framework for software projects" },
    { content: "Which phase comes FIRST in the waterfall model?", answer: "Requirements", choices: ["Design", "Testing", "Requirements", "Implementation"], hint: "Gathering what the system must do" },
    { content: "A DFD shows...", answer: "How data moves through a system", choices: ["How code is structured", "How data moves through a system", "Database table relations", "User interface layout"], hint: "Data Flow Diagram" },
    { content: "Feasibility study evaluates...", answer: "Whether the project is viable", choices: ["How to code the system", "Whether the project is viable", "Which database to use", "How many developers are needed"], hint: "Is it worth building?" },
  ]);

  const sadBubble = await createLevel(sadId, 5, "SAD Bubble Pop", "bubble_pop", 85, 24, "medium");
  await addBubbleQuestions(sadBubble, [
    { content: "Early working model of a system to gather user feedback", answer: "Prototype", choices: ["Prototype", "Use Case", "Flowchart", "ERD"] },
    { content: "Visual representation of how data moves through a system", answer: "DFD", choices: ["DFD", "UML", "Gantt", "PERT"] },
    { content: "Boundaries and extent of a system project", answer: "Scope", choices: ["Scope", "Budget", "Schedule", "Risk"] },
    { content: "Diagram depicting relationships between database entities", answer: "ERD", choices: ["ERD", "DFD", "Wireframe", "Flowchart"] },
    { content: "Process of gathering and documenting stakeholder needs", answer: "Requirements Elicitation", choices: ["Requirements Elicitation", "System Design", "Code Review", "Testing"] },
  ]);

  const sadMemory = await createLevel(sadId, 6, "SAD Memory Flip", "memory_flip", 90, 26, "hard");
  await addMemoryPairs(sadMemory, [
    { term: "Use Case", definition: "Interaction scenario between a user and the system" },
    { term: "Actor", definition: "External entity that interacts with the system" },
    { term: "Prototype", definition: "Early model used to test ideas and gather feedback" },
    { term: "SDLC", definition: "Framework defining phases for software development" },
    { term: "DFD", definition: "Diagram showing data movement through a system" },
    { term: "Feasibility", definition: "Assessment of whether a project is viable" },
    { term: "Scope Creep", definition: "Uncontrolled expansion of project requirements" },
    { term: "Stakeholder", definition: "Person with interest in or affected by the system" },
  ]);

  // ===== PROGRAMMING FUNDAMENTALS =====
  const progBlitz = await createLevel(progId, 4, "Code Speed Round", "speed_blitz", 80, 22, "medium");
  await addBlitzQuestions(progBlitz, [
    { content: "Which OOP principle hides internal implementation details?", answer: "Abstraction", choices: ["Inheritance", "Polymorphism", "Abstraction", "Encapsulation"], hint: "Showing only the essential" },
    { content: "A function that calls itself is called...", answer: "Recursive", choices: ["Iterative", "Recursive", "Synchronous", "Callback"], hint: "Calls itself until base case" },
    { content: "Which data type stores True/False values?", answer: "Boolean", choices: ["Integer", "Float", "Boolean", "String"], hint: "Binary logic value" },
    { content: "OOP stands for...", answer: "Object-Oriented Programming", choices: ["Open Optimized Platform", "Object-Oriented Programming", "Operational Output Process", "Ordered Output Paradigm"], hint: "Classes and objects" },
    { content: "A class that inherits from another class is called a...", answer: "Subclass", choices: ["Superclass", "Interface", "Subclass", "Module"], hint: "Child class" },
  ]);

  const progBubble = await createLevel(progId, 5, "Prog Bubble Pop", "bubble_pop", 85, 24, "medium");
  await addBubbleQuestions(progBubble, [
    { content: "Blueprint for creating objects in OOP", answer: "Class", choices: ["Class", "Function", "Array", "Loop"] },
    { content: "Bundling data and methods into a single unit", answer: "Encapsulation", choices: ["Encapsulation", "Inheritance", "Recursion", "Abstraction"] },
    { content: "Arranging elements in ascending or descending order", answer: "Sorting", choices: ["Sorting", "Hashing", "Parsing", "Looping"] },
    { content: "Variable that cannot be changed after assignment", answer: "Constant", choices: ["Constant", "Variable", "Parameter", "Pointer"] },
    { content: "Block of reusable code that performs a specific task", answer: "Function", choices: ["Function", "Loop", "Class", "Array"] },
  ]);

  const progMemory = await createLevel(progId, 6, "Prog Memory Flip", "memory_flip", 90, 26, "hard");
  await addMemoryPairs(progMemory, [
    { term: "Encapsulation", definition: "Bundling data and methods within one class unit" },
    { term: "Inheritance", definition: "Child class acquires properties from parent class" },
    { term: "Polymorphism", definition: "Same interface behaves differently across object types" },
    { term: "Abstraction", definition: "Hiding complexity, exposing only essential features" },
    { term: "Constructor", definition: "Special method called when an object is created" },
    { term: "Interface", definition: "Contract defining methods a class must implement" },
    { term: "Recursion", definition: "Function that calls itself with a smaller input" },
    { term: "Big O", definition: "Notation describing algorithm's time complexity" },
  ]);

  // ===== DATA STRUCTURES =====
  const dsBlitz = await createLevel(dsId, 4, "DS Speed Round", "speed_blitz", 85, 24, "hard");
  await addBlitzQuestions(dsBlitz, [
    { content: "Which structure follows Last-In-First-Out (LIFO)?", answer: "Stack", choices: ["Queue", "Stack", "Array", "Graph"], hint: "Think of a stack of plates" },
    { content: "A binary search tree requires the data to be...", answer: "Sorted", choices: ["Unique", "Sorted", "Linked", "Hashed"], hint: "Left < Parent < Right" },
    { content: "What is the time complexity of binary search?", answer: "O(log n)", choices: ["O(n)", "O(n²)", "O(log n)", "O(1)"], hint: "Halves the search space each time" },
    { content: "A graph with no cycles is called a...", answer: "Tree", choices: ["Tree", "Heap", "Stack", "Matrix"], hint: "Hierarchical acyclic graph" },
    { content: "Which structure uses a hash function to store data?", answer: "Hash Table", choices: ["Queue", "Linked List", "Hash Table", "Binary Tree"], hint: "Key-value mapping" },
  ]);

  const dsBubble = await createLevel(dsId, 5, "DS Bubble Pop", "bubble_pop", 88, 25, "hard");
  await addBubbleQuestions(dsBubble, [
    { content: "Linear data structure where elements are connected by pointers", answer: "Linked List", choices: ["Linked List", "Array", "Stack", "Queue"] },
    { content: "Tree where each node has at most two children", answer: "Binary Tree", choices: ["Binary Tree", "Heap", "Graph", "Trie"] },
    { content: "First-In-First-Out data structure", answer: "Queue", choices: ["Queue", "Stack", "Deque", "Heap"] },
    { content: "Structure that maps keys to values using a hash function", answer: "Hash Map", choices: ["Hash Map", "Array", "Tree", "Stack"] },
    { content: "Complete binary tree satisfying heap property", answer: "Heap", choices: ["Heap", "AVL Tree", "Trie", "B-Tree"] },
  ]);

  const dsMemory = await createLevel(dsId, 6, "DS Memory Flip", "memory_flip", 95, 28, "hard");
  await addMemoryPairs(dsMemory, [
    { term: "Stack", definition: "LIFO structure — last added is first removed" },
    { term: "Queue", definition: "FIFO structure — first added is first removed" },
    { term: "Binary Tree", definition: "Tree where every node has at most 2 children" },
    { term: "Linked List", definition: "Nodes connected by pointers to the next node" },
    { term: "Hash Table", definition: "Stores key-value pairs using a hash function" },
    { term: "Graph", definition: "Set of vertices connected by edges" },
    { term: "Heap", definition: "Complete binary tree satisfying parent-child order" },
    { term: "AVL Tree", definition: "Self-balancing binary search tree" },
  ]);

  // ===== DATABASE SYSTEMS =====
  const dbBlitz = await createLevel(dbId, 4, "SQL Speed Round", "speed_blitz", 80, 22, "medium");
  await addBlitzQuestions(dbBlitz, [
    { content: "Which SQL command retrieves data from a table?", answer: "SELECT", choices: ["INSERT", "UPDATE", "SELECT", "DELETE"], hint: "Used to read records" },
    { content: "What does ACID stand for in databases?", answer: "Atomicity, Consistency, Isolation, Durability", choices: ["Atomicity, Consistency, Isolation, Durability", "Array, Column, Index, Data", "Access, Create, Insert, Delete", "Aggregate, Commit, Index, Duplicate"], hint: "Transaction properties" },
    { content: "Which normalization form eliminates partial dependencies?", answer: "2NF", choices: ["1NF", "2NF", "3NF", "BCNF"], hint: "Second Normal Form" },
    { content: "A PRIMARY KEY must be...", answer: "Unique and NOT NULL", choices: ["Unique and NOT NULL", "Only unique", "Only NOT NULL", "Any value"], hint: "Uniquely identifies each row" },
    { content: "Which JOIN returns all rows from both tables?", answer: "FULL OUTER JOIN", choices: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"], hint: "Everything from both sides" },
  ]);

  const dbBubble = await createLevel(dbId, 5, "DB Bubble Pop", "bubble_pop", 85, 24, "medium");
  await addBubbleQuestions(dbBubble, [
    { content: "Unique identifier for each record in a database table", answer: "Primary Key", choices: ["Primary Key", "Foreign Key", "Index", "Constraint"] },
    { content: "Field referencing the primary key of another table", answer: "Foreign Key", choices: ["Foreign Key", "Primary Key", "Trigger", "View"] },
    { content: "Database object that speeds up data retrieval", answer: "Index", choices: ["Index", "View", "Cursor", "Schema"] },
    { content: "Virtual table derived from a SELECT statement", answer: "View", choices: ["View", "Table", "Index", "Trigger"] },
    { content: "Process of organizing data to reduce redundancy", answer: "Normalization", choices: ["Normalization", "Indexing", "Sharding", "Caching"] },
  ]);

  const dbMemory = await createLevel(dbId, 6, "DB Memory Flip", "memory_flip", 90, 26, "hard");
  await addMemoryPairs(dbMemory, [
    { term: "Primary Key", definition: "Uniquely identifies every record in a table" },
    { term: "Foreign Key", definition: "References primary key of another table" },
    { term: "Normalization", definition: "Organizing data to remove redundancy" },
    { term: "Transaction", definition: "Atomic sequence of database operations" },
    { term: "Index", definition: "Structure that speeds up data retrieval" },
    { term: "JOIN", definition: "Combines rows from two or more tables" },
    { term: "View", definition: "Virtual table defined by a SELECT query" },
    { term: "Stored Procedure", definition: "Precompiled SQL routine stored in the database" },
  ]);

  // ===== COMPUTER NETWORKS =====
  const netBlitz = await createLevel(netId, 4, "Network Speed Round", "speed_blitz", 85, 24, "hard");
  await addBlitzQuestions(netBlitz, [
    { content: "How many layers does the OSI model have?", answer: "7", choices: ["4", "5", "7", "9"], hint: "Physical to Application" },
    { content: "Which protocol converts domain names to IP addresses?", answer: "DNS", choices: ["DHCP", "FTP", "DNS", "SSH"], hint: "Domain Name System" },
    { content: "TCP is a _____ protocol", answer: "Connection-oriented", choices: ["Connectionless", "Connection-oriented", "Broadcast", "Multicast"], hint: "It establishes a connection first" },
    { content: "Which port does HTTPS use?", answer: "443", choices: ["80", "443", "21", "22"], hint: "Secure web traffic" },
    { content: "ARP resolves...", answer: "IP to MAC address", choices: ["Domain to IP", "IP to MAC address", "MAC to IP", "Port to Service"], hint: "Address Resolution Protocol" },
  ]);

  const netBubble = await createLevel(netId, 5, "Network Bubble Pop", "bubble_pop", 88, 25, "hard");
  await addBubbleQuestions(netBubble, [
    { content: "Protocol for reliable, ordered data delivery between hosts", answer: "TCP", choices: ["TCP", "UDP", "ICMP", "ARP"] },
    { content: "Device that forwards packets between different networks", answer: "Router", choices: ["Router", "Switch", "Hub", "Modem"] },
    { content: "Security device controlling network traffic based on rules", answer: "Firewall", choices: ["Firewall", "Router", "Proxy", "Gateway"] },
    { content: "Technology creating an encrypted tunnel over the internet", answer: "VPN", choices: ["VPN", "NAT", "DNS", "CDN"] },
    { content: "Protocol that assigns IP addresses automatically", answer: "DHCP", choices: ["DHCP", "DNS", "HTTP", "FTP"] },
  ]);

  const netMemory = await createLevel(netId, 6, "Network Memory Flip", "memory_flip", 95, 28, "hard");
  await addMemoryPairs(netMemory, [
    { term: "TCP", definition: "Reliable connection-oriented transport protocol" },
    { term: "UDP", definition: "Fast connectionless protocol, no delivery guarantee" },
    { term: "DNS", definition: "Translates domain names to IP addresses" },
    { term: "DHCP", definition: "Automatically assigns IP addresses to hosts" },
    { term: "Router", definition: "Forwards packets between different networks" },
    { term: "Firewall", definition: "Filters network traffic by security rules" },
    { term: "OSI Model", definition: "Seven-layer standard for network communication" },
    { term: "VPN", definition: "Encrypted private tunnel over a public network" },
  ]);

  // ===== SOFTWARE ENGINEERING =====
  const seBlitz = await createLevel(seId, 4, "SE Speed Round", "speed_blitz", 80, 22, "medium");
  await addBlitzQuestions(seBlitz, [
    { content: "Agile sprints typically last...", answer: "1-4 weeks", choices: ["1-4 days", "1-4 weeks", "1-4 months", "1 year"], hint: "Short time-boxed iterations" },
    { content: "Which testing type validates end-to-end system behavior?", answer: "Integration Testing", choices: ["Unit Testing", "Integration Testing", "Static Analysis", "Code Review"], hint: "Tests how parts work together" },
    { content: "In Scrum, who owns the product backlog?", answer: "Product Owner", choices: ["Scrum Master", "Developer", "Product Owner", "Stakeholder"], hint: "Represents the business side" },
    { content: "Refactoring changes...", answer: "Code structure only", choices: ["External behavior", "Code structure only", "Database schema", "UI design"], hint: "No functional change" },
    { content: "CI/CD stands for...", answer: "Continuous Integration / Continuous Deployment", choices: ["Code Integration / Code Delivery", "Continuous Integration / Continuous Deployment", "Compile Install / Check Deploy", "Control Integration / Control Development"], hint: "Automation of build and release" },
  ]);

  const seBubble = await createLevel(seId, 5, "SE Bubble Pop", "bubble_pop", 85, 24, "medium");
  await addBubbleQuestions(seBubble, [
    { content: "Time-boxed iteration in Scrum methodology", answer: "Sprint", choices: ["Sprint", "Release", "Backlog", "Epic"] },
    { content: "Restructuring code without changing its behavior", answer: "Refactoring", choices: ["Refactoring", "Debugging", "Testing", "Deploying"] },
    { content: "Automated integration of code changes into shared repository", answer: "Continuous Integration", choices: ["Continuous Integration", "Code Review", "Unit Testing", "Pair Programming"] },
    { content: "Future rework cost from quick but imperfect decisions", answer: "Technical Debt", choices: ["Technical Debt", "Bug Count", "Code Smell", "Entropy"] },
    { content: "Ordered list of features waiting to be developed", answer: "Product Backlog", choices: ["Product Backlog", "Sprint Board", "Release Log", "Bug Tracker"] },
  ]);

  const seMemory = await createLevel(seId, 6, "SE Memory Flip", "memory_flip", 90, 26, "hard");
  await addMemoryPairs(seMemory, [
    { term: "Sprint", definition: "Short time-boxed development iteration in Scrum" },
    { term: "Refactoring", definition: "Improving code structure without changing behavior" },
    { term: "CI/CD", definition: "Automation of build, test, and deployment pipeline" },
    { term: "Technical Debt", definition: "Future rework from quick but suboptimal code" },
    { term: "Code Review", definition: "Peer examination of code for quality and bugs" },
    { term: "Version Control", definition: "System tracking all changes to source code" },
    { term: "Scrum Master", definition: "Facilitator who removes obstacles for the team" },
    { term: "Kanban", definition: "Visual workflow management with cards and columns" },
  ]);

  console.log("[IKUGAMES] New game type levels seeded successfully!");
}

export async function removeFakeSeedUsers() {
  try {
    const fakeUsernames = ["CyberSage","NeonCoder","QuantumLearner","DataWizard","AlgoMaster","ByteHunter","NetRunner","CodePhantom"];
    for (const username of fakeUsernames) {
      await q("DELETE FROM users WHERE username = $1 AND is_admin = false", [username]);
    }
    console.log("[IKUGAMES] Fake seed users removed.");
  } catch (e) {
    // Ignore if already removed
  }
}

export async function seedDatabase() {
  try {
    const [{ count }] = await q("SELECT COUNT(*) as count FROM topics");
    if (Number(count) > 0) return;
  } catch (e) {
    return;
  }

  console.log("[EduQuest] Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await q(
    "INSERT INTO users (username, password, xp, level, streak, edu_coins, is_admin) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    ["admin", adminHash, 5000, 15, 30, 9999, true]
  );

  // Sample leaderboard users
  const sampleUsers = [
    ["CyberSage", 8500, 45, 20, 850],
    ["NeonCoder", 6200, 22, 17, 620],
    ["QuantumLearner", 4800, 18, 14, 480],
    ["DataWizard", 3200, 12, 11, 320],
    ["AlgoMaster", 2100, 8, 8, 210],
    ["ByteHunter", 1400, 5, 6, 140],
    ["NetRunner", 900, 3, 4, 90],
    ["CodePhantom", 450, 1, 2, 45],
  ];
  for (const [username, xp, streak, level, coins] of sampleUsers) {
    const hash = await bcrypt.hash("password123", 10);
    await q(
      "INSERT INTO users (username, password, xp, streak, level, edu_coins) VALUES ($1,$2,$3,$4,$5,$6)",
      [username, hash, xp, streak, level, coins]
    );
  }

  // Topics
  const topicsData = [
    ["System Analysis & Design", "Master SDLC, requirements analysis, UML diagrams, and system design methodologies", "Settings", "from-violet-600 to-purple-800", 0],
    ["Programming Fundamentals", "Core programming concepts: algorithms, data types, OOP, and problem solving", "Code2", "from-blue-600 to-cyan-700", 1],
    ["Data Structures", "Arrays, linked lists, trees, graphs, heaps, and algorithmic complexity", "GitBranch", "from-emerald-600 to-teal-700", 2],
    ["Database Systems", "SQL, normalization, ER diagrams, transactions, and query optimization", "Database", "from-amber-600 to-orange-700", 3],
    ["Computer Networks", "OSI model, TCP/IP, routing, protocols, and network security fundamentals", "Network", "from-pink-600 to-rose-700", 4],
    ["Software Engineering", "Agile, Scrum, SDLC models, testing, version control, and CI/CD", "Layers", "from-indigo-600 to-blue-800", 5],
  ];

  const topicIds: string[] = [];
  for (const [name, desc, icon, color, orderIdx] of topicsData) {
    const [t] = await q(
      "INSERT INTO topics (name, description, icon, color, order_index) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [name, desc, icon, color, orderIdx]
    );
    topicIds.push(t.id);
  }

  // Helper to create level + questions
  async function createLevel(topicId: string, levelNum: number, name: string, gameType: string, xpR: number, coinR: number, diff: string) {
    const [l] = await q(
      "INSERT INTO levels (topic_id, level_number, name, game_type, xp_reward, coin_reward, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [topicId, levelNum, name, gameType, xpR, coinR, diff]
    );
    return l.id as string;
  }

  async function createWordleQuestions(levelId: string, words: string[], hints: string[]) {
    for (let i = 0; i < words.length; i++) {
      await q(
        "INSERT INTO questions (level_id, content, answer, hint, order_index) VALUES ($1,$2,$3,$4,$5)",
        [levelId, `Guess the keyword (${i + 1}/${words.length})`, words[i], hints[i], i]
      );
    }
  }

  async function createMatcherQuestions(levelId: string, pairs: { term: string; definition: string }[]) {
    const optionsJson = JSON.stringify({ pairs });
    for (let i = 0; i < pairs.length; i++) {
      await q(
        "INSERT INTO questions (level_id, content, answer, options, order_index) VALUES ($1,$2,$3,$4::jsonb,$5)",
        [levelId, pairs[i].term, pairs[i].definition, optionsJson, i]
      );
    }
  }

  async function createEmojiQuestions(levelId: string, items: { content: string; answer: string; choices: string[]; hint: string }[]) {
    for (let i = 0; i < items.length; i++) {
      const optionsJson = JSON.stringify({ choices: items[i].choices });
      await q(
        "INSERT INTO questions (level_id, content, answer, options, hint, order_index) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",
        [levelId, items[i].content, items[i].answer, optionsJson, items[i].hint, i]
      );
    }
  }

  // ======= SYSTEM ANALYSIS & DESIGN =======
  const sadId = topicIds[0];
  const sadL1 = await createLevel(sadId, 1, "SDLC Vocabulary", "wordle", 50, 15, "easy");
  await createWordleQuestions(sadL1,
    ["SCOPE", "MODEL", "PHASE", "FLOWS", "ACTOR"],
    ["Boundaries and extent of a project", "A representation of a system or concept", "A distinct stage in a process or lifecycle", "Movement of data through a system (DFD)", "An entity that interacts with the system in UML"]
  );

  const sadL2 = await createLevel(sadId, 2, "System Concepts", "matcher", 60, 18, "easy");
  await createMatcherQuestions(sadL2, [
    { term: "Feasibility Study", definition: "Analysis of whether a proposed system is viable technically and economically" },
    { term: "Use Case Diagram", definition: "UML diagram showing interactions between users and the system" },
    { term: "Data Flow Diagram", definition: "Visual representation of how data moves through a system" },
    { term: "ER Diagram", definition: "Diagram that depicts relationships between entities in a database" },
    { term: "Requirements Elicitation", definition: "Process of gathering and documenting stakeholder needs" },
    { term: "Prototyping", definition: "Creating an early working model of a system to gather feedback" },
  ]);

  const sadL3 = await createLevel(sadId, 3, "SDLC Phases Cipher", "emoji_cipher", 70, 20, "medium");
  await createEmojiQuestions(sadL3, [
    { content: "Magnifying glass + Document + Checklist = ?", answer: "Requirements Analysis", choices: ["Requirements Analysis", "System Design", "User Testing", "Code Review"], hint: "First phase of SDLC" },
    { content: "Blueprint + Ruler + Architecture diagram = ?", answer: "System Design", choices: ["System Design", "Implementation", "Maintenance", "Planning"], hint: "Creating the technical blueprint" },
    { content: "Laptop + Code brackets + Gears = ?", answer: "Implementation", choices: ["Testing", "Implementation", "Deployment", "Analysis"], hint: "Writing the actual code" },
    { content: "Bug + Checklist + Verify checkmark = ?", answer: "Testing & Validation", choices: ["Requirements", "Testing & Validation", "Design", "Maintenance"], hint: "Quality assurance phase" },
    { content: "Rocket launch + Server + Go live = ?", answer: "Deployment", choices: ["Deployment", "Planning", "Testing", "Design"], hint: "Making the system live" },
  ]);

  // ======= PROGRAMMING FUNDAMENTALS =======
  const progId = topicIds[1];
  const progL1 = await createLevel(progId, 1, "Code Keywords", "wordle", 50, 15, "easy");
  await createWordleQuestions(progL1,
    ["CLASS", "LOOPS", "ARRAY", "TYPED", "DEBUG"],
    ["Blueprint for creating objects in OOP", "Repetitive execution structures in programming", "Ordered collection of elements of the same type", "Language characteristic with strict type checking", "Process of finding and fixing code errors"]
  );

  const progL2 = await createLevel(progId, 2, "OOP Concepts", "matcher", 65, 18, "medium");
  await createMatcherQuestions(progL2, [
    { term: "Encapsulation", definition: "Bundling data and methods that operate on that data within one unit" },
    { term: "Inheritance", definition: "Mechanism where a class acquires properties and behaviors of another class" },
    { term: "Polymorphism", definition: "Ability of different objects to respond to the same interface differently" },
    { term: "Abstraction", definition: "Hiding complex implementation details and showing only essential features" },
    { term: "Constructor", definition: "Special method called when an object is instantiated" },
    { term: "Interface", definition: "Contract specifying what methods a class must implement" },
  ]);

  const progL3 = await createLevel(progId, 3, "Algorithm Concepts", "emoji_cipher", 75, 22, "medium");
  await createEmojiQuestions(progL3, [
    { content: "Numbers + Arrow up + Arrow down = ?", answer: "Sorting Algorithm", choices: ["Sorting Algorithm", "Binary Search", "Recursion", "Hashing"], hint: "Arranging elements in order" },
    { content: "Function + Calls + Itself again = ?", answer: "Recursion", choices: ["Iteration", "Recursion", "Looping", "Callback"], hint: "A function that calls itself" },
    { content: "Find + Middle + Split in half = ?", answer: "Binary Search", choices: ["Linear Search", "Binary Search", "Hash Lookup", "Tree Search"], hint: "Efficient search on sorted data" },
    { content: "Big letter O + Clock + Complexity = ?", answer: "Big O Notation", choices: ["Big O Notation", "Space Complexity", "Runtime Error", "Loop Count"], hint: "Measuring algorithm efficiency" },
    { content: "Key + Value + Lightning fast = ?", answer: "Hash Map", choices: ["Array", "Queue", "Hash Map", "Stack"], hint: "Key-value storage structure" },
  ]);

  // ======= DATA STRUCTURES =======
  const dsId = topicIds[2];
  const dsL1 = await createLevel(dsId, 1, "DS Vocabulary", "wordle", 55, 16, "easy");
  await createWordleQuestions(dsL1,
    ["STACK", "QUEUE", "GRAPH", "TREES", "HEAPS"],
    ["LIFO data structure for storing elements", "FIFO data structure for processing elements", "Network of vertices connected by edges", "Hierarchical data structures with parent-child relationships", "Complete binary tree satisfying heap property"]
  );

  const dsL2 = await createLevel(dsId, 2, "Data Structure Match", "matcher", 70, 20, "medium");
  await createMatcherQuestions(dsL2, [
    { term: "Stack", definition: "LIFO structure where elements are added and removed from the top" },
    { term: "Queue", definition: "FIFO structure where elements are added at back and removed from front" },
    { term: "Binary Tree", definition: "Tree where each node has at most two children: left and right" },
    { term: "Linked List", definition: "Linear structure where elements are stored in nodes with pointers to next" },
    { term: "Hash Table", definition: "Data structure that maps keys to values using a hash function" },
    { term: "Graph", definition: "Non-linear structure consisting of vertices connected by edges" },
  ]);

  const dsL3 = await createLevel(dsId, 3, "Algorithm Cipher", "emoji_cipher", 80, 24, "hard");
  await createEmojiQuestions(dsL3, [
    { content: "Last plate + In pile + First out = ?", answer: "Stack LIFO", choices: ["Queue FIFO", "Stack LIFO", "Array", "Deque"], hint: "Think of a stack of plates" },
    { content: "Tree + Search + Left smaller + Right bigger = ?", answer: "Binary Search Tree", choices: ["AVL Tree", "Binary Search Tree", "Heap", "Trie"], hint: "Ordered binary tree for fast search" },
    { content: "Node + Arrow + Points to next = ?", answer: "Linked List", choices: ["Array", "Linked List", "Stack", "Queue"], hint: "Nodes connected by pointers" },
    { content: "Parent on top + Children below + Complete tree = ?", answer: "Heap", choices: ["Heap", "Graph", "B-Tree", "Map"], hint: "Used in priority queues" },
    { content: "Dots + Lines connecting + Path between = ?", answer: "Graph Traversal", choices: ["Tree Search", "Graph Traversal", "Sorting", "Hashing"], hint: "Visiting all nodes in a graph" },
  ]);

  // ======= DATABASE SYSTEMS =======
  const dbId = topicIds[3];
  const dbL1 = await createLevel(dbId, 1, "SQL Keywords", "wordle", 55, 16, "easy");
  await createWordleQuestions(dbL1,
    ["INDEX", "TABLE", "QUERY", "VIEWS", "JOINS"],
    ["Database object that speeds up data retrieval", "Rows and columns structure holding data in DB", "Request to retrieve or manipulate database data", "Virtual tables derived from SQL SELECT statements", "SQL operation combining rows from multiple tables"]
  );

  const dbL2 = await createLevel(dbId, 2, "DB Concepts Match", "matcher", 65, 18, "medium");
  await createMatcherQuestions(dbL2, [
    { term: "Primary Key", definition: "Unique identifier for each record in a database table" },
    { term: "Foreign Key", definition: "Field referencing the primary key of another table to establish relationships" },
    { term: "Normalization", definition: "Process of organizing database to reduce redundancy and improve integrity" },
    { term: "Transaction", definition: "Sequence of database operations treated as a single atomic unit of work" },
    { term: "Index", definition: "Database object that speeds up data retrieval operations on a table" },
    { term: "JOIN", definition: "SQL operation that combines rows from two or more tables based on a related column" },
  ]);

  const dbL3 = await createLevel(dbId, 3, "DB Concepts Cipher", "emoji_cipher", 75, 22, "medium");
  await createEmojiQuestions(dbL3, [
    { content: "Organize + Remove duplicates + Clean = ?", answer: "Normalization", choices: ["Normalization", "Indexing", "Partitioning", "Sharding"], hint: "Eliminating data redundancy" },
    { content: "ACID + Safe commit + Rollback = ?", answer: "Transaction", choices: ["Transaction", "Query", "Join", "View"], hint: "Atomic unit of database work" },
    { content: "SELECT + FROM + WHERE = ?", answer: "SQL Query", choices: ["DDL Statement", "SQL Query", "Stored Procedure", "Trigger"], hint: "Data retrieval command" },
    { content: "Two tables + Reference + Link = ?", answer: "Foreign Key", choices: ["Primary Key", "Index", "Foreign Key", "Constraint"], hint: "Table relationship enforcer" },
    { content: "Speed up + Lookup + Pointer structure = ?", answer: "Database Index", choices: ["Database Index", "Cursor", "View", "Cache"], hint: "Makes queries faster" },
  ]);

  // ======= COMPUTER NETWORKS =======
  const netId = topicIds[4];
  const netL1 = await createLevel(netId, 1, "Network Terms", "wordle", 60, 18, "easy");
  await createWordleQuestions(netL1,
    ["ROUTE", "PROXY", "LAYER", "PORTS", "CACHE"],
    ["Path taken by data packets across a network", "Intermediary server handling requests on behalf of clients", "Level in the OSI networking model stack", "Endpoints identifying specific applications in networking", "Temporary storage layer for faster data access"]
  );

  const netL2 = await createLevel(netId, 2, "Protocol Match", "matcher", 70, 20, "medium");
  await createMatcherQuestions(netL2, [
    { term: "HTTP/HTTPS", definition: "Protocol for transferring hypertext documents on the World Wide Web" },
    { term: "TCP", definition: "Reliable, connection-oriented transport protocol ensuring ordered data delivery" },
    { term: "DNS", definition: "System that translates human-readable domain names into IP addresses" },
    { term: "OSI Model", definition: "Seven-layer conceptual framework standardizing network communication" },
    { term: "Router", definition: "Network device that forwards data packets between different networks" },
    { term: "Firewall", definition: "Security device monitoring and controlling incoming and outgoing network traffic" },
  ]);

  const netL3 = await createLevel(netId, 3, "Network Cipher", "emoji_cipher", 80, 24, "hard");
  await createEmojiQuestions(netL3, [
    { content: "Seven floors + Building + Network communication = ?", answer: "OSI Model", choices: ["OSI Model", "TCP/IP Stack", "Protocol Suite", "Network Stack"], hint: "Layered network architecture" },
    { content: "Four numbers + Dots + Address = ?", answer: "IPv4 Address", choices: ["MAC Address", "IPv4 Address", "DNS Record", "Port Number"], hint: "32-bit network identifier" },
    { content: "Encrypted + Secure + Private tunnel = ?", answer: "VPN", choices: ["VPN", "Firewall", "Proxy", "Gateway"], hint: "Virtual private network" },
    { content: "Wireless signal + Radio waves + Connect = ?", answer: "WiFi Network", choices: ["WiFi Network", "Ethernet", "Bluetooth", "Fiber Optic"], hint: "Wireless networking technology" },
    { content: "SYN + SYN-ACK + ACK = ?", answer: "TCP Three-Way Handshake", choices: ["UDP Protocol", "TCP Three-Way Handshake", "IP Routing", "ARP Request"], hint: "Connection establishment process" },
  ]);

  // ======= SOFTWARE ENGINEERING =======
  const seId = topicIds[5];
  const seL1 = await createLevel(seId, 1, "SE Vocabulary", "wordle", 60, 18, "easy");
  await createWordleQuestions(seL1,
    ["AGILE", "TESTS", "PATCH", "MERGE", "SCRUM"],
    ["Iterative and incremental software development methodology", "Code that validates software functionality automatically", "Small software fix applied to correct specific bugs", "Combining changes from different branches in git", "Agile framework with sprints, standups, and retrospectives"]
  );

  const seL2 = await createLevel(seId, 2, "Agile Concepts", "matcher", 70, 20, "medium");
  await createMatcherQuestions(seL2, [
    { term: "Sprint", definition: "Time-boxed iteration in Scrum methodology typically lasting 1-4 weeks" },
    { term: "Refactoring", definition: "Restructuring existing code without changing its external behavior or functionality" },
    { term: "Continuous Integration", definition: "Practice of frequently merging developer code changes into a shared repository" },
    { term: "Technical Debt", definition: "Cost of additional future rework caused by choosing quick but suboptimal solutions" },
    { term: "Code Review", definition: "Systematic examination of source code to find bugs and ensure quality standards" },
    { term: "Version Control", definition: "System that tracks and manages changes to source code files over time" },
  ]);

  const seL3 = await createLevel(seId, 3, "Dev Process Cipher", "emoji_cipher", 85, 25, "hard");
  await createEmojiQuestions(seL3, [
    { content: "Plan + Short iteration + Review + Adapt = ?", answer: "Agile Methodology", choices: ["Agile Methodology", "Waterfall Model", "Spiral Model", "V-Model"], hint: "Flexible iterative approach" },
    { content: "Small team + Daily standup + Sprint + Demo = ?", answer: "Scrum Framework", choices: ["Scrum Framework", "Kanban Board", "XP Programming", "Lean Dev"], hint: "Most popular Agile framework" },
    { content: "Code commit + Auto build + Auto test + Auto deploy = ?", answer: "CI/CD Pipeline", choices: ["CI/CD Pipeline", "Git Workflow", "Code Review", "Testing Suite"], hint: "Automation of build and deployment" },
    { content: "Find bug + Isolate + Fix + Test again = ?", answer: "Debugging Process", choices: ["Debugging Process", "Code Review", "Unit Testing", "QA Testing"], hint: "Systematic error resolution" },
    { content: "User stories + Prioritize + Future work = ?", answer: "Product Backlog", choices: ["Sprint Planning", "Product Backlog", "Release Notes", "User Manual"], hint: "Ordered list of features to build" },
  ]);

  // ======= COSMETICS =======
  const cosmeticsData = [
    ["Shadow Wizard", "avatar", 200, "wizard", "A mystical wizard of the digital realm", "epic"],
    ["Cyber Bot", "avatar", 150, "robot", "An advanced AI learning companion", "rare"],
    ["Phoenix Coder", "avatar", 300, "phoenix", "Rise from bugs like a phoenix from ashes", "legendary"],
    ["Data Dragon", "avatar", 250, "dragon", "Guardian of the data realm and master of bytes", "legendary"],
    ["Byte Knight", "avatar", 100, "knight", "Defender of clean code and best practices", "common"],
    ["Neon Purple Frame", "frame", 120, "neon-purple", "Glowing purple energy border effect", "rare"],
    ["Electric Blue Frame", "frame", 120, "neon-blue", "Crackling blue electricity border effect", "rare"],
    ["Golden Legend Frame", "frame", 400, "golden", "Reserved only for true legends of EduQuest", "legendary"],
    ["Matrix Frame", "frame", 180, "matrix", "Green digital rain cascading border effect", "epic"],
    ["Cyberpunk Theme", "theme", 300, "cyberpunk", "Neon pink and yellow cyberpunk city aesthetic", "epic"],
    ["Deep Space Theme", "theme", 250, "space", "Dark universe with animated starfield effects", "epic"],
    ["Matrix Green Theme", "theme", 200, "matrix-theme", "Classic hacker green-on-black terminal theme", "rare"],
    ["Ocean Depths Theme", "theme", 180, "ocean", "Deep blue submarine and bioluminescent aesthetic", "rare"],
    ["Fire & Ice Theme", "theme", 350, "fire-ice", "Dual flame and frost dramatic color scheme", "legendary"],
  ];

  for (const [name, type, price, icon, description, rarity] of cosmeticsData) {
    await q(
      "INSERT INTO cosmetics (name, type, price, icon, description, rarity) VALUES ($1,$2,$3,$4,$5,$6)",
      [name, type, price, icon, description, rarity]
    );
  }

  console.log("[EduQuest] Seeding complete!");
  await pool.end();
}
