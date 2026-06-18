# HoopMotion 1.0 Rig Builder Research Notes

The v1 Rig Builder remains a web app because the current Three.js stack already supports the MVP workflow:

- `GLTFLoader` loads GLB/GLTF models.
- `Raycaster` supports click placement on model meshes.
- `TransformControls` supports direct marker adjustment.
- JSON sidecars can be exported without native packaging.

The main product boundary is skinning. Clicked dots define a retarget profile and rest-pose markers; they do not create glTF `JOINTS_0`, `WEIGHTS_0`, joints, or inverse bind matrices for an unrigged mesh. True auto-rigging and skin weights should be handled by Mixamo, AccuRIG, or Blender before HoopMotion retargeting.

Sources:

- Three.js Raycaster: <https://threejs.org/docs/pages/Raycaster.html>
- Three.js TransformControls: <https://threejs.org/docs/pages/TransformControls.html>
- Three.js SkeletonUtils: <https://threejs.org/docs/pages/module-SkeletonUtils.html>
- Three.js SkinnedMesh: <https://threejs.org/docs/pages/SkinnedMesh.html>
- glTF skinning tutorial: <https://github.khronos.org/glTF-Tutorials/gltfTutorial/gltfTutorial_020_Skins.html>
- glTF Transform: <https://gltf-transform.dev/>
- VRM features: <https://vrm.dev/en/vrm/vrm_features/>
- Mixamo auto-rig docs: <https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html>
