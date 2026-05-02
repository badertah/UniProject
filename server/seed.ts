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

export async function seedBadges() {
  try {
    const existing = await q("SELECT COUNT(*) as count FROM badges");
    if (Number(existing[0].count) > 0) return;
  } catch (e) { return; }

  console.log("[IKUGAMES] Seeding badges...");

  const badgeData = [
    // XP Milestones
    { name: "First Spark", desc: "Earn your first 100 XP", icon: "⚡", color: "from-yellow-400 to-amber-600", req: "xp_milestone", val: 100, xp: 0, coins: 5, rarity: "common" },
    { name: "Knowledge Seeker", desc: "Earn 500 XP", icon: "📚", color: "from-blue-400 to-cyan-600", req: "xp_milestone", val: 500, xp: 20, coins: 10, rarity: "common" },
    { name: "Mind Expanded", desc: "Earn 1,000 XP", icon: "🧠", color: "from-violet-500 to-purple-700", req: "xp_milestone", val: 1000, xp: 50, coins: 20, rarity: "rare" },
    { name: "Scholar Elite", desc: "Earn 3,500 XP", icon: "🎓", color: "from-emerald-400 to-teal-600", req: "xp_milestone", val: 3500, xp: 100, coins: 40, rarity: "epic" },
    { name: "XP Legend", desc: "Earn 7,000 XP — true mastery!", icon: "👑", color: "from-yellow-400 to-orange-600", req: "xp_milestone", val: 7000, xp: 200, coins: 100, rarity: "legendary" },
    // Streak Badges
    { name: "On Fire", desc: "Maintain a 3-day streak", icon: "🔥", color: "from-orange-400 to-red-600", req: "streak", val: 3, xp: 0, coins: 5, rarity: "common" },
    { name: "Week Warrior", desc: "Maintain a 7-day streak", icon: "⚔️", color: "from-red-400 to-rose-600", req: "streak", val: 7, xp: 30, coins: 15, rarity: "rare" },
    { name: "Fortnight Fighter", desc: "Maintain a 14-day streak", icon: "🛡️", color: "from-indigo-400 to-blue-600", req: "streak", val: 14, xp: 75, coins: 30, rarity: "epic" },
    { name: "Monthly Master", desc: "Maintain a 30-day streak", icon: "💎", color: "from-cyan-400 to-blue-600", req: "streak", val: 30, xp: 200, coins: 80, rarity: "legendary" },
    // Level Completion
    { name: "First Victory", desc: "Complete your first level", icon: "⭐", color: "from-yellow-300 to-yellow-500", req: "levels_complete", val: 1, xp: 10, coins: 5, rarity: "common" },
    { name: "High Five", desc: "Complete 5 levels", icon: "🖐️", color: "from-green-400 to-emerald-600", req: "levels_complete", val: 5, xp: 25, coins: 10, rarity: "common" },
    { name: "Level Crusher", desc: "Complete 10 levels", icon: "🎯", color: "from-blue-400 to-indigo-600", req: "levels_complete", val: 10, xp: 60, coins: 25, rarity: "rare" },
    { name: "Course Conqueror", desc: "Complete 20 levels", icon: "🏆", color: "from-amber-400 to-yellow-600", req: "levels_complete", val: 20, xp: 120, coins: 50, rarity: "epic" },
    { name: "Grandmaster", desc: "Complete all 36 levels", icon: "🌟", color: "from-rose-400 to-pink-600", req: "levels_complete", val: 36, xp: 300, coins: 150, rarity: "legendary" },
    // Game Type Badges
    { name: "Word Wizard", desc: "Complete a Word Guesser level", icon: "📝", color: "from-slate-400 to-slate-600", req: "game_type_wordle", val: 1, xp: 10, coins: 5, rarity: "common" },
    { name: "Match Maker", desc: "Complete a Matcher level", icon: "🔗", color: "from-teal-400 to-cyan-600", req: "game_type_matcher", val: 1, xp: 10, coins: 5, rarity: "common" },
    { name: "Cipher Cracker", desc: "Complete an Emoji Cipher level", icon: "🔓", color: "from-amber-400 to-orange-600", req: "game_type_emoji_cipher", val: 1, xp: 10, coins: 5, rarity: "common" },
    { name: "Speed Demon", desc: "Complete a Speed Blitz level", icon: "⚡", color: "from-yellow-300 to-red-500", req: "game_type_speed_blitz", val: 1, xp: 15, coins: 8, rarity: "rare" },
    { name: "Bubble Master", desc: "Complete a Bubble Pop level", icon: "🫧", color: "from-sky-300 to-blue-500", req: "game_type_bubble_pop", val: 1, xp: 15, coins: 8, rarity: "rare" },
    { name: "Memory King", desc: "Complete a Memory Flip level", icon: "🧩", color: "from-purple-400 to-violet-600", req: "game_type_memory_flip", val: 1, xp: 15, coins: 8, rarity: "rare" },
  ];

  for (const b of badgeData) {
    await q(
      `INSERT INTO badges (name, description, icon, color, requirement_type, requirement_value, xp_reward, coin_reward, rarity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [b.name, b.desc, b.icon, b.color, b.req, b.val, b.xp, b.coins, b.rarity]
    );
  }
  console.log("[IKUGAMES] Badges seeded:", badgeData.length);
}

// ===========================================================
// SAD Play-to-Learn — interactive games (no quiz questions)
// Each "question" row stores one puzzle round; structured data
// lives in `options` JSON. Idempotent guard via gameType check.
// ===========================================================
export async function seedSADPlayToLearn() {
  try {
    const existing = await q(
      "SELECT COUNT(*) as count FROM levels WHERE game_type IN ('sdlc_sorter','req_sorter','usecase_builder','erd_doctor','dfd_detective','sequence_stacker')"
    );
    if (Number(existing[0].count) > 0) return;
  } catch (e) { return; }

  // Find the SAD topic
  const sadRows = await q("SELECT id FROM topics WHERE name ILIKE '%system analysis%' LIMIT 1");
  if (sadRows.length === 0) return;
  const sadId = sadRows[0].id as string;

  console.log("[IKUGAMES] Seeding SAD play-to-learn games...");

  // Wipe legacy SAD levels (and their questions + any progress) so the user
  // sees only the new play-to-learn experience. memory_flip and wordle are
  // kept on purpose — the user explicitly asked to keep those classics.
  const oldLevels = await q(
    "SELECT id FROM levels WHERE topic_id = $1 AND game_type NOT IN ('sdlc_sorter','req_sorter','usecase_builder','erd_doctor','dfd_detective','sequence_stacker','memory_flip','wordle')",
    [sadId]
  );
  for (const lvl of oldLevels) {
    await q("DELETE FROM user_progress WHERE level_id = $1", [lvl.id]);
    await q("DELETE FROM questions WHERE level_id = $1", [lvl.id]);
    await q("DELETE FROM levels WHERE id = $1", [lvl.id]);
  }

  async function createLevel(num: number, name: string, gameType: string, xp: number, coins: number, diff: string) {
    const [l] = await q(
      "INSERT INTO levels (topic_id, level_number, name, game_type, xp_reward, coin_reward, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [sadId, num, name, gameType, xp, coins, diff]
    );
    return l.id as string;
  }

  async function addRound(levelId: string, content: string, answer: string, options: any, idx: number) {
    await q(
      "INSERT INTO questions (level_id, content, answer, options, order_index) VALUES ($1,$2,$3,$4::jsonb,$5)",
      [levelId, content, answer, JSON.stringify(options), idx]
    );
  }

  // ---------- L1: SDLC Sorter (Phase Runner) ----------
  const l1 = await createLevel(1, "Phase Runner", "sdlc_sorter", 60, 18, "easy");
  const sdlcRounds = [
    {
      content: "A small team is starting a brand-new banking app from scratch. Survive all 6 SDLC phases in order.",
      methodology: "Classic Waterfall",
      phases: ["Planning", "Analysis", "Design", "Implementation", "Testing", "Maintenance"],
      explanation: "The classic SDLC follows: plan it, analyze needs, design the solution, build it, test it, then maintain it in production.",
    },
    {
      content: "Order the steps the team takes to gather and document what users need before writing any code.",
      methodology: "Requirements Engineering",
      phases: ["Elicit Requirements", "Analyze Requirements", "Specify Requirements", "Validate Requirements"],
      explanation: "First you elicit (gather) requirements, then analyze them, write a clear specification, and finally validate them with stakeholders.",
    },
    {
      content: "Order the steps in a single Agile sprint cycle.",
      methodology: "Agile Sprint",
      phases: ["Sprint Planning", "Daily Standup", "Development", "Sprint Review", "Sprint Retrospective"],
      explanation: "An Agile sprint starts with planning, runs daily standups during development, ends with a review of the work, and a retrospective to improve.",
    },
    {
      content: "A startup is prototyping a social media feature. Put the rapid prototype cycle in order.",
      methodology: "Prototype Cycle",
      phases: ["Identify Need", "Build Prototype", "User Review", "Refine", "Integrate"],
      explanation: "Prototyping is iterative: identify the need, build a quick prototype, get user feedback, refine, and integrate the best ideas.",
    },
  ];
  for (let i = 0; i < sdlcRounds.length; i++) {
    const r = sdlcRounds[i];
    await addRound(l1, r.content, r.phases.join("|"), r, i);
  }

  // ---------- L2: Requirements Sorter (Spec Highway) ----------
  const l2 = await createLevel(2, "Spec Highway", "req_sorter", 65, 20, "easy");
  const reqRounds = [
    { content: "The user must be able to log in with their email and password.", answer: "functional", explanation: "Login is something the system DOES — that's a functional requirement." },
    { content: "The system must respond to every page request in under 2 seconds.", answer: "non_functional", explanation: "Response time is a quality attribute (performance) — non-functional." },
    { content: "Users can search for a product by its name or barcode.", answer: "functional", explanation: "Search is a feature the system performs — functional." },
    { content: "All passwords must be encrypted using bcrypt before storage.", answer: "non_functional", explanation: "Security/encryption is a quality requirement — non-functional." },
    { content: "Customers can add items to a shopping cart and check out.", answer: "functional", explanation: "Add-to-cart and checkout are concrete actions — functional." },
    { content: "The website must be available 99.9% of the time.", answer: "non_functional", explanation: "Availability/uptime is a non-functional quality requirement." },
    { content: "Admins can ban users who violate the terms of service.", answer: "functional", explanation: "Banning users is an admin feature — functional." },
    { content: "The interface must follow WCAG 2.1 accessibility guidelines.", answer: "non_functional", explanation: "Accessibility is a usability quality — non-functional." },
    { content: "Users can export their data as a CSV file.", answer: "functional", explanation: "Exporting data is a direct system action — functional." },
    { content: "The system must handle 10,000 concurrent users without degradation.", answer: "non_functional", explanation: "Scalability is a performance quality — non-functional." },
  ];
  for (let i = 0; i < reqRounds.length; i++) {
    await addRound(l2, reqRounds[i].content, reqRounds[i].answer, { explanation: reqRounds[i].explanation }, i);
  }

  // ---------- L3: Use Case Connector (Use Case Defense) ----------
  const l3 = await createLevel(3, "Use Case Defense", "usecase_builder", 75, 22, "medium");
  const ucRounds = [
    {
      content: "Online Library System — figure out which actor stops which system failure.",
      actors: [
        { id: "reader",    label: "Reader",    emoji: "📖" },
        { id: "librarian", label: "Librarian", emoji: "🧑‍💼" },
      ],
      useCases: [
        { label: "Borrow a Book",        actorId: "reader" },
        { label: "Return a Book",        actorId: "reader" },
        { label: "Add a New Book",       actorId: "librarian" },
        { label: "Issue a Membership",   actorId: "librarian" },
        { label: "Search the Catalogue", actorId: "reader" },
      ],
      explanation: "Readers borrow, return and search. Librarians manage the catalogue and memberships.",
    },
    {
      content: "Online Shop — match each defense to the right actor.",
      actors: [
        { id: "customer", label: "Customer", emoji: "🛒" },
        { id: "admin",    label: "Admin",    emoji: "🛠️" },
        { id: "courier",  label: "Courier",  emoji: "📦" },
      ],
      useCases: [
        { label: "Place an Order",        actorId: "customer" },
        { label: "Add a Product",         actorId: "admin" },
        { label: "Update Order Status",   actorId: "courier" },
        { label: "View Order History",    actorId: "customer" },
        { label: "Manage Discount Codes", actorId: "admin" },
      ],
      explanation: "Customers place orders and see their history. Admins manage products and discounts. Couriers update delivery status.",
    },
    {
      content: "Hospital Management — identify the actors for each critical use case.",
      actors: [
        { id: "doctor",   label: "Doctor",   emoji: "🩺" },
        { id: "patient",  label: "Patient",  emoji: "🤒" },
        { id: "reception", label: "Reception", emoji: "📋" },
      ],
      useCases: [
        { label: "Prescribe Medication",  actorId: "doctor" },
        { label: "Book Appointment",      actorId: "patient" },
        { label: "Check In Patient",      actorId: "reception" },
        { label: "View Medical Records",  actorId: "doctor" },
        { label: "Pay Bill",              actorId: "patient" },
      ],
      explanation: "Doctors prescribe and view records. Patients book and pay. Reception handles check-ins.",
    },
  ];
  for (let i = 0; i < ucRounds.length; i++) {
    await addRound(l3, ucRounds[i].content, "see_options", ucRounds[i], i);
  }

  // ---------- L4: ER Diagram Doctor (ER City Builder) ----------
  const l4 = await createLevel(4, "ER City Builder", "erd_doctor", 80, 24, "medium");
  const erdRounds = [
    { content: "In an online shop, every Customer can place many Orders, but each Order belongs to exactly one Customer. What's the cardinality?",
      answer: "1:N", left: "Customer", right: "Order",
      explanation: "One customer → many orders, but each order has only one customer. Classic 1-to-many." },
    { content: "Each Person has exactly one Passport, and each Passport belongs to exactly one Person.",
      answer: "1:1", left: "Person", right: "Passport",
      explanation: "Both sides are exactly one — that's a one-to-one relationship." },
    { content: "A Student can enroll in many Courses, and each Course can have many Students.",
      answer: "N:N", left: "Student", right: "Course",
      explanation: "Both sides have many on the other side — many-to-many. In implementation this needs a junction table." },
    { content: "An Author can write many Books, and a Book in this database is written by exactly one Author.",
      answer: "1:N", left: "Author", right: "Book",
      explanation: "One author writes many books; each book has one author here. 1-to-many." },
    { content: "A Movie can be tagged with many Genres, and a Genre can apply to many Movies.",
      answer: "N:N", left: "Movie", right: "Genre",
      explanation: "Movies and genres connect freely — many-to-many." },
    { content: "An Employee manages exactly one Department, and each Department has exactly one Manager.",
      answer: "1:1", left: "Employee", right: "Department",
      explanation: "Both sides are exactly one manager-to-department. One-to-one." },
    { content: "A Category can contain many Products, but each Product belongs to exactly one Category.",
      answer: "1:N", left: "Category", right: "Product",
      explanation: "One category has many products. Each product has one category. 1-to-many." },
  ];
  for (let i = 0; i < erdRounds.length; i++) {
    const r = erdRounds[i];
    await addRound(l4, r.content, r.answer, { left: r.left, right: r.right, explanation: r.explanation }, i);
  }

  // ---------- L5: Data Flow Detective (Data Flow Plumber) ----------
  const l5 = await createLevel(5, "Data Flow Plumber", "dfd_detective", 85, 26, "medium");
  const dfdRounds = [
    {
      content: "Online Order System — the diagram is missing the flow that delivers the receipt to the customer.",
      missingLabel: "Receipt",
      nodes: [
        { id: "cust",  label: "Customer",       type: "source" },
        { id: "place", label: "Place Order",    type: "process" },
        { id: "store", label: "Orders DB",      type: "store" },
        { id: "email", label: "Email Receipt",  type: "process" },
      ],
      existingFlows: [
        { from: "cust",  to: "place", label: "Order details" },
        { from: "place", to: "store", label: "Save order" },
        { from: "store", to: "email", label: "Order data" },
      ],
      correctFrom: "email",
      correctTo: "cust",
      explanation: "After 'Email Receipt' formats the receipt, the data flows back to the Customer (the original source/sink).",
    },
    {
      content: "Library Borrow System — the flow that records the loan in the Loans store is missing.",
      missingLabel: "Loan record",
      nodes: [
        { id: "reader", label: "Reader",        type: "source" },
        { id: "borrow", label: "Borrow Book",   type: "process" },
        { id: "books",  label: "Books DB",      type: "store" },
        { id: "loans",  label: "Loans DB",      type: "store" },
      ],
      existingFlows: [
        { from: "reader", to: "borrow", label: "Book ID" },
        { from: "books",  to: "borrow", label: "Book status" },
      ],
      correctFrom: "borrow",
      correctTo: "loans",
      explanation: "The 'Borrow Book' process must write the new loan into the Loans DB. Two stores can never connect directly — a process must sit between them.",
    },
    {
      content: "Payroll System — the flow sending pay slips to employees is missing.",
      missingLabel: "Pay slip",
      nodes: [
        { id: "emp",     label: "Employee",       type: "source" },
        { id: "calc",    label: "Calculate Pay",  type: "process" },
        { id: "payroll", label: "Payroll DB",     type: "store" },
        { id: "send",    label: "Send Pay Slip",  type: "process" },
      ],
      existingFlows: [
        { from: "emp",     to: "calc",    label: "Hours worked" },
        { from: "calc",    to: "payroll", label: "Pay record" },
        { from: "payroll", to: "send",    label: "Pay record" },
      ],
      correctFrom: "send",
      correctTo: "emp",
      explanation: "After 'Send Pay Slip' formats the slip, it flows back to the Employee — who is both the source of hours and the sink for the slip.",
    },
    {
      content: "Registration System — the flow that validates the email against the Users DB is missing.",
      missingLabel: "Email check",
      nodes: [
        { id: "user",   label: "New User",      type: "source" },
        { id: "reg",    label: "Register",     type: "process" },
        { id: "users",  label: "Users DB",      type: "store" },
        { id: "notify", label: "Send Welcome", type: "process" },
      ],
      existingFlows: [
        { from: "user",  to: "reg",    label: "Form data" },
        { from: "reg",   to: "notify", label: "User data" },
      ],
      correctFrom: "reg",
      correctTo: "users",
      explanation: "The Register process must check the Users DB to see if the email already exists before creating the account.",
    },
  ];
  for (let i = 0; i < dfdRounds.length; i++) {
    const r = dfdRounds[i];
    await addRound(l5, r.content, `${r.correctFrom}->${r.correctTo}`, r, i);
  }

  // ---------- L6: Sequence Stacker (Sequence Rhythm) ----------
  const l6 = await createLevel(6, "Sequence Rhythm", "sequence_stacker", 90, 28, "medium");
  const seqRounds = [
    {
      content: "User Login Flow — order the messages from earliest (top) to latest (bottom).",
      objects: ["User", "LoginPage", "AuthService", "Database"],
      steps: [
        "User enters email and password",
        "LoginPage sends credentials to AuthService",
        "AuthService asks Database for matching user",
        "Database returns the user record",
        "AuthService verifies the password hash",
        "LoginPage redirects User to dashboard",
      ],
      explanation: "Each message can only happen after the data it depends on has arrived. The user types first; the database is asked before it can answer.",
    },
    {
      content: "ATM Cash Withdrawal — order the messages in time.",
      objects: ["Customer", "ATM", "Bank"],
      steps: [
        "Customer inserts card",
        "ATM asks Customer for PIN",
        "Customer enters PIN",
        "ATM sends PIN to Bank for verification",
        "Bank confirms PIN is valid",
        "Customer requests cash amount",
        "ATM dispenses the cash",
      ],
      explanation: "Each step waits for the previous one to finish — the bank can only verify after a PIN exists, and cash only comes out after authorization.",
    },
    {
      content: "Place Order Online — order the messages in time.",
      objects: ["Customer", "Web App", "Payment", "Warehouse"],
      steps: [
        "Customer adds items to cart",
        "Customer clicks Checkout",
        "Web App creates a pending order",
        "Web App requests payment from Payment service",
        "Payment confirms charge succeeded",
        "Web App tells Warehouse to ship the order",
        "Web App shows order confirmation to Customer",
      ],
      explanation: "Order creation comes before payment, payment before shipment, and confirmation only at the end once everything succeeded.",
    },
    {
      content: "Upload Profile Picture — order the messages in time.",
      objects: ["User", "Frontend", "ImageService", "CDN"],
      steps: [
        "User selects an image file",
        "Frontend validates file type and size",
        "Frontend sends image to ImageService",
        "ImageService resizes and compresses the image",
        "ImageService uploads optimized image to CDN",
        "CDN returns the public URL",
        "Frontend displays the new profile picture",
      ],
      explanation: "Validation happens before upload, processing happens before CDN storage, and the URL must exist before the UI can display it.",
    },
  ];
  for (let i = 0; i < seqRounds.length; i++) {
    const r = seqRounds[i];
    await addRound(l6, r.content, r.steps.join("|"), r, i);
  }

  // ---------- L7: SAD Vocab Wordle (kept by user request) ----------
  // Only insert if not already present (idempotent — DB may already have one).
  const existingWordle = await q(
    "SELECT id FROM levels WHERE topic_id=$1 AND game_type='wordle' LIMIT 1",
    [sadId]
  );
  if (existingWordle.length === 0) {
    const l7 = await createLevel(7, "SAD Vocab Wordle", "wordle", 60, 18, "easy");
    const wordleWords: [string, string][] = [
      ["SCOPE", "Boundaries and extent of a project"],
      ["MODEL", "A representation of a system or concept"],
      ["PHASE", "A distinct stage in a process or lifecycle"],
      ["FLOWS", "Movement of data through a system (DFD)"],
      ["ACTOR", "An entity that interacts with the system in UML"],
    ];
    for (let i = 0; i < wordleWords.length; i++) {
      const [w, h] = wordleWords[i];
      await q(
        "INSERT INTO questions (level_id, content, answer, hint, order_index) VALUES ($1,$2,$3,$4,$5)",
        [l7, `Guess the SAD keyword (${i + 1}/${wordleWords.length})`, w, h, i]
      );
    }
  }

  console.log("[IKUGAMES] SAD play-to-learn games seeded successfully.");
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

// ============================================================================
// Idempotent: ensure the SAD topic has a "System Architect" sim level. Runs
// every boot independently of seedSADPlayToLearn (which guards on first run)
// so existing DBs that were seeded earlier still pick up the new game.
// ============================================================================
export async function seedSystemArchitectLevel() {
  try {
    const sadRows = await q("SELECT id FROM topics WHERE name ILIKE '%system analysis%' LIMIT 1");
    if (sadRows.length === 0) return;
    const sadId = sadRows[0].id as string;

    const existing = await q(
      "SELECT id FROM levels WHERE topic_id = $1 AND game_type = 'system_architect' LIMIT 1",
      [sadId]
    );
    if (existing.length > 0) return;

    // Pick the next free level number after the existing SAD levels.
    const nums = await q("SELECT COALESCE(MAX(level_number),0) as n FROM levels WHERE topic_id = $1", [sadId]);
    const nextNum = Number(nums[0].n) + 1;

    const [lvl] = await q(
      "INSERT INTO levels (topic_id, level_number, name, game_type, xp_reward, coin_reward, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [sadId, nextNum, "System Architect", "system_architect", 110, 35, "hard"]
    );
    // The sim is the game; one round seed so the runner has at least one row.
    await q(
      "INSERT INTO questions (level_id, content, answer, options, order_index) VALUES ($1,$2,$3,$4::jsonb,$5)",
      [
        lvl.id,
        "Build a server infrastructure that survives the surge of users without crashing!",
        "survive",
        JSON.stringify({ sim: true, explanation: "Real systems use Firewall + Load Balancer + many Web Servers + Database to scale horizontally. Add capacity faster than traffic grows." }),
        0,
      ]
    );
    console.log("[IKUGAMES] System Architect level seeded.");
  } catch (e) {
    console.warn("[IKUGAMES] seedSystemArchitectLevel failed:", e);
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
