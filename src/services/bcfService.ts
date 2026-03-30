/**
 * BCF (BIM Collaboration Format) 2.1 file read/write service.
 * Handles ZIP + XML parsing for topics, comments, and viewpoints.
 */

export interface BcfViewpointCamera {
  viewPoint: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  upVector: { x: number; y: number; z: number };
  fieldOfView?: number;
  type: "perspective" | "orthographic";
}

export interface BcfViewpoint {
  guid: string;
  camera: BcfViewpointCamera;
  snapshotBase64?: string;
}

export interface BcfComment {
  guid: string;
  date: string;
  author: string;
  comment: string;
  viewpointGuid?: string;
  modifiedDate?: string;
  modifiedAuthor?: string;
}

export interface BcfTopic {
  guid: string;
  title: string;
  description: string;
  creationDate: string;
  creationAuthor: string;
  modifiedDate?: string;
  modifiedAuthor?: string;
  topicType: string;
  topicStatus: string;
  priority: string;
  assignedTo: string;
  labels: string[];
  comments: BcfComment[];
  viewpoints: BcfViewpoint[];
}

export interface BcfProject {
  projectId: string;
  projectName: string;
  topics: BcfTopic[];
}

function generateGuid(): string {
  return crypto.randomUUID();
}

function getTextContent(parent: Element, tagName: string): string {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() ?? "";
}

function parsePoint(el: Element | null): { x: number; y: number; z: number } {
  if (!el) return { x: 0, y: 0, z: 0 };
  return {
    x: parseFloat(getTextContent(el, "X")) || 0,
    y: parseFloat(getTextContent(el, "Y")) || 0,
    z: parseFloat(getTextContent(el, "Z")) || 0,
  };
}

function parseViewpointXml(xml: string): BcfViewpointCamera | null {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  const perspective = doc.getElementsByTagName("PerspectiveCamera")[0];
  const ortho = doc.getElementsByTagName("OrthogonalCamera")[0];
  const cam = perspective ?? ortho;
  if (!cam) return null;

  return {
    viewPoint: parsePoint(cam.getElementsByTagName("CameraViewPoint")[0]),
    direction: parsePoint(cam.getElementsByTagName("CameraDirection")[0]),
    upVector: parsePoint(cam.getElementsByTagName("CameraUpVector")[0]),
    fieldOfView: perspective
      ? parseFloat(getTextContent(cam, "FieldOfView")) || 60
      : undefined,
    type: perspective ? "perspective" : "orthographic",
  };
}

function parseMarkupXml(xml: string): {
  topic: Omit<BcfTopic, "viewpoints">;
  viewpointRefs: { guid: string; viewpointFile: string; snapshotFile: string }[];
} {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const topicEl = doc.getElementsByTagName("Topic")[0];
  if (!topicEl) throw new Error("No Topic element in markup.bcf");

  const guid = topicEl.getAttribute("Guid") ?? generateGuid();

  const labels: string[] = [];
  for (const labelEl of topicEl.getElementsByTagName("Labels")) {
    labels.push(labelEl.textContent?.trim() ?? "");
  }

  const comments: BcfComment[] = [];
  for (const commentEl of doc.getElementsByTagName("Comment")) {
    comments.push({
      guid: commentEl.getAttribute("Guid") ?? generateGuid(),
      date: getTextContent(commentEl, "Date"),
      author: getTextContent(commentEl, "Author"),
      comment: getTextContent(commentEl, "Comment"),
      viewpointGuid:
        commentEl.getElementsByTagName("Viewpoint")[0]?.getAttribute("Guid") ?? undefined,
      modifiedDate: getTextContent(commentEl, "ModifiedDate") || undefined,
      modifiedAuthor: getTextContent(commentEl, "ModifiedAuthor") || undefined,
    });
  }

  const viewpointRefs: { guid: string; viewpointFile: string; snapshotFile: string }[] = [];
  for (const vpEl of doc.getElementsByTagName("ViewPoint")) {
    viewpointRefs.push({
      guid: vpEl.getAttribute("Guid") ?? generateGuid(),
      viewpointFile: vpEl.textContent?.trim() ?? "viewpoint.bcfv",
      snapshotFile:
        vpEl.nextElementSibling?.tagName === "Snapshot"
          ? (vpEl.nextElementSibling.textContent?.trim() ?? "snapshot.png")
          : "snapshot.png",
    });
  }

  return {
    topic: {
      guid,
      title: getTextContent(topicEl, "Title"),
      description: getTextContent(topicEl, "Description"),
      creationDate: getTextContent(topicEl, "CreationDate"),
      creationAuthor: getTextContent(topicEl, "CreationAuthor"),
      modifiedDate: getTextContent(topicEl, "ModifiedDate") || undefined,
      modifiedAuthor: getTextContent(topicEl, "ModifiedAuthor") || undefined,
      topicType: getTextContent(topicEl, "TopicType"),
      topicStatus: getTextContent(topicEl, "TopicStatus"),
      priority: getTextContent(topicEl, "Priority"),
      assignedTo: getTextContent(topicEl, "AssignedTo"),
      labels,
      comments,
    },
    viewpointRefs,
  };
}

export async function importBcfZip(file: File): Promise<BcfProject> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);

  let projectId = "default";
  let projectName = file.name.replace(/\.bcf(zip)?$/i, "");

  const projectXml = zip.file("project.bcfp") ?? zip.file("bcf.version");
  if (projectXml) {
    const text = await projectXml.async("string");
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const projEl = doc.getElementsByTagName("Project")[0];
    if (projEl) {
      projectId = projEl.getAttribute("ProjectId") ?? projectId;
      projectName = getTextContent(projEl, "Name") || projectName;
    }
  }

  const topicDirs = new Set<string>();
  zip.forEach((path) => {
    const parts = path.split("/");
    if (parts.length > 1 && parts[0]) {
      topicDirs.add(parts[0]);
    }
  });

  const topics: BcfTopic[] = [];

  for (const dir of topicDirs) {
    const markupFile = zip.file(`${dir}/markup.bcf`);
    if (!markupFile) continue;

    const markupXml = await markupFile.async("string");
    const { topic, viewpointRefs } = parseMarkupXml(markupXml);

    const viewpoints: BcfViewpoint[] = [];
    for (const ref of viewpointRefs) {
      const vpFile = zip.file(`${dir}/${ref.viewpointFile}`);
      if (!vpFile) continue;

      const vpXml = await vpFile.async("string");
      const camera = parseViewpointXml(vpXml);
      if (!camera) continue;

      let snapshotBase64: string | undefined;
      const snapshotFile = zip.file(`${dir}/${ref.snapshotFile}`);
      if (snapshotFile) {
        const base64 = await snapshotFile.async("base64");
        snapshotBase64 = `data:image/png;base64,${base64}`;
      }

      viewpoints.push({
        guid: ref.guid,
        camera,
        snapshotBase64,
      });
    }

    topics.push({ ...topic, viewpoints });
  }

  return { projectId, projectName, topics };
}

export function createEmptyTopic(
  title: string,
  description: string,
  author: string,
): BcfTopic {
  return {
    guid: generateGuid(),
    title,
    description,
    creationDate: new Date().toISOString(),
    creationAuthor: author,
    topicType: "Issue",
    topicStatus: "Open",
    priority: "Normal",
    assignedTo: "",
    labels: [],
    comments: [],
    viewpoints: [],
  };
}

export function createComment(text: string, author: string, viewpointGuid?: string): BcfComment {
  return {
    guid: generateGuid(),
    date: new Date().toISOString(),
    author,
    comment: text,
    viewpointGuid,
  };
}

function buildPointXml(tag: string, p: { x: number; y: number; z: number }): string {
  return `<${tag}><X>${p.x}</X><Y>${p.y}</Y><Z>${p.z}</Z></${tag}>`;
}

export async function exportBcfZip(project: BcfProject): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  zip.file(
    "bcf.version",
    `<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1" />\n`,
  );

  for (const topic of project.topics) {
    const dir = topic.guid;

    let viewpointsMarkup = "";
    for (const vp of topic.viewpoints) {
      viewpointsMarkup += `<ViewPoint Guid="${vp.guid}">${vp.guid}.bcfv</ViewPoint>\n<Snapshot>${vp.guid}.png</Snapshot>\n`;

      const camTag =
        vp.camera.type === "perspective"
          ? "PerspectiveCamera"
          : "OrthogonalCamera";
      const fovXml =
        vp.camera.type === "perspective" && vp.camera.fieldOfView
          ? `<FieldOfView>${vp.camera.fieldOfView}</FieldOfView>`
          : "";
      const vpXml = `<?xml version="1.0" encoding="UTF-8"?>\n<VisualizationInfo Guid="${vp.guid}">\n<${camTag}>\n${buildPointXml("CameraViewPoint", vp.camera.viewPoint)}\n${buildPointXml("CameraDirection", vp.camera.direction)}\n${buildPointXml("CameraUpVector", vp.camera.upVector)}\n${fovXml}\n</${camTag}>\n</VisualizationInfo>\n`;
      zip.file(`${dir}/${vp.guid}.bcfv`, vpXml);

      if (vp.snapshotBase64) {
        const base64Data = vp.snapshotBase64.split(",")[1];
        if (base64Data) {
          zip.file(`${dir}/${vp.guid}.png`, base64Data, { base64: true });
        }
      }
    }

    let commentsMarkup = "";
    for (const c of topic.comments) {
      const vpRef = c.viewpointGuid
        ? `<Viewpoint Guid="${c.viewpointGuid}" />`
        : "";
      commentsMarkup += `<Comment Guid="${c.guid}"><Date>${c.date}</Date><Author>${c.author}</Author><Comment>${c.comment}</Comment>${vpRef}</Comment>\n`;
    }

    const labelsMarkup = topic.labels.map((l) => `<Labels>${l}</Labels>`).join("\n");

    const markupXml = `<?xml version="1.0" encoding="UTF-8"?>\n<Markup>\n<Topic Guid="${topic.guid}" TopicType="${topic.topicType}" TopicStatus="${topic.topicStatus}">\n<Title>${topic.title}</Title>\n<Description>${topic.description}</Description>\n<CreationDate>${topic.creationDate}</CreationDate>\n<CreationAuthor>${topic.creationAuthor}</CreationAuthor>\n<Priority>${topic.priority}</Priority>\n<AssignedTo>${topic.assignedTo}</AssignedTo>\n${labelsMarkup}\n</Topic>\n${commentsMarkup}\n${viewpointsMarkup}\n</Markup>\n`;
    zip.file(`${dir}/markup.bcf`, markupXml);
  }

  return zip.generateAsync({ type: "blob" });
}
