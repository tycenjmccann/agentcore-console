"use client";

import { useState } from "react";
import ArtifactList from "./ArtifactList";
import ArtifactPreview from "./ArtifactPreview";
import PRLinks from "./PRLinks";

interface ArtifactsTabProps {
  workflowId: string;
}

export default function ArtifactsTab({ workflowId }: ArtifactsTabProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="relative h-full">
      <div className="p-6 h-full overflow-y-auto">
        {/* PR Links at the top */}
        <PRLinks workflowId={workflowId} />

        {/* Artifact file tree */}
        <ArtifactList
          workflowId={workflowId}
          onSelectFile={(filePath) => setSelectedFile(filePath)}
          selectedFile={selectedFile}
        />
      </div>

      {/* Preview side panel */}
      {selectedFile && (
        <ArtifactPreview
          workflowId={workflowId}
          filePath={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
