'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import MapControls from './MapControls';
import MapLegend from './MapLegend';
import MapSearch from './MapSearch';
import RegionInfoPanel from './RegionInfoPanel';
import {
  boundsToViewBox,
  geometryToPath,
  normalizeArabic,
  screenToSvgPoint,
  viewBoxToString,
  zoomViewBox,
} from './mapGeometry';
import {visibleLabelIds} from '@/lib/mapLabels';

const DATA_URL = '/data/yemen-map/yemen-boundaries.json';
// Shown before smaller neighbours when labels compete for space: Taiz, Aden, Marib, Hodeidah.
const MAIN_CITIES = ['YE15', 'YE24', 'YE26', 'YE18'];

export default function YemenMap({focusedGovernorateId, onGovernorateChange, onGovernorateExplore, initialDistrictId = null,showFigures=true}) {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const appliedDistrict = useRef(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [profiles, setProfiles] = useState({});
  const [profileError,setProfileError]=useState('');
  const [query, setQuery] = useState('');
  const [viewBox, setViewBox] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [selectedGovernorate, setSelectedGovernorate] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [labelSizeMode, setLabelSizeMode] = useState('medium');
  // The map's size on screen, so labels keep a readable size on phones.
  const [canvasSize, setCanvasSize] = useState(null);
  const [districtsVisible, setDistrictsVisible] = useState(false);

  useEffect(() => {
    if (selectedGovernorate) onGovernorateExplore?.(selectedGovernorate.id, selectedGovernorate.nameAr);
  }, [selectedGovernorate, onGovernorateExplore]);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    fetch(DATA_URL).then(response => {if (!response.ok) throw new Error('Map unavailable'); return response.json();}).then(payload => {
      if (!active) return;
      setData(payload);
      setViewBox(boundsToViewBox(payload.country.bounds, 0.1));
    }).catch(() => {if (active) setLoadError(true);});
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    let active = true;
    const controller=new AbortController();
    const loadProfiles=()=>fetch('/api/map-profiles',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(result=>{if(active){setProfiles(result.profiles);setProfileError('');}}).catch(error=>{if(active&&error.name!=='AbortError')setProfileError('تعذر تحميل المعلومات الموسعة للأماكن. ما زالت الحدود والبحث الجغرافي متاحين.');});
    loadProfiles();
    const refresh=event=>{if(['governorate','district'].includes(event.detail?.target?.kind))loadProfiles();};
    window.addEventListener('967:inline-content-saved',refresh);
    return () => { active = false;controller.abort();window.removeEventListener('967:inline-content-saved',refresh); };
  }, []);

  const selectedRegion = selectedDistrict || selectedGovernorate;
  const visibleDistricts = useMemo(() => {
    if (!data || !districtsVisible) return [];
    if (selectedGovernorate) return data.districts.filter(item => item.governorateId === selectedGovernorate.id);
    return data.districts;
  }, [data, selectedGovernorate, districtsVisible]);

  const searchResults = useMemo(() => {
    if (!data) return [];
    const normalized = normalizeArabic(query);
    if (!normalized) return [];
    const governorates = data.governorates
      .filter(item => [item.nameAr, item.nameEn, item.pcode].some(value => normalizeArabic(value).includes(normalized)))
      .map(item => ({...item, type: 'governorate'}));
    const districts = data.districts
      .filter(item => [item.nameAr, item.nameEn, item.pcode, item.governorateNameAr].some(value => normalizeArabic(value).includes(normalized)))
      .slice(0, 12)
      .map(item => ({...item, type: 'district'}));
    return [...governorates, ...districts].slice(0, 10);
  }, [data, query]);

  const fitBounds = useCallback((bounds, padding = 0.12) => {
    setViewBox(boundsToViewBox(bounds, padding));
  }, []);

  const selectGovernorate = useCallback((governorate) => {
    setSelectedGovernorate(governorate);
    setSelectedDistrict(null);
    setDistrictsVisible(true);
    fitBounds(governorate.bounds, 0.12);
    onGovernorateChange?.(governorate.id);
  }, [fitBounds, onGovernorateChange]);

  const selectDistrict = useCallback((district) => {
    const governorate = data?.governorates.find(item => item.id === district.governorateId);
    if (governorate) setSelectedGovernorate(governorate);
    setSelectedDistrict(district);
    setDistrictsVisible(true);
    fitBounds(district.bounds, 0.18);
    onGovernorateChange?.(district.governorateId,district.id);
  }, [data, fitBounds, onGovernorateChange]);

  const resetMap = useCallback(() => {
    if (!data) return;
    setSelectedGovernorate(null);
    setSelectedDistrict(null);
    setDistrictsVisible(false);
    fitBounds(data.country.bounds, 0.1);
    onGovernorateChange?.(null);
  }, [data, fitBounds, onGovernorateChange]);

  useEffect(() => {
    if (!data || focusedGovernorateId === undefined) return;
    if (!focusedGovernorateId) {
      if (!selectedGovernorate && !selectedDistrict) return;
      setSelectedGovernorate(null);
      setSelectedDistrict(null);
      setDistrictsVisible(false);
      fitBounds(data.country.bounds, 0.1);
      return;
    }
    if (selectedGovernorate?.id === focusedGovernorateId) return;
    const governorate = data.governorates.find(item => item.id === focusedGovernorateId);
    if (!governorate) return;
    setSelectedGovernorate(governorate);
    setSelectedDistrict(null);
    setDistrictsVisible(true);
    fitBounds(governorate.bounds, 0.12);
  }, [data, fitBounds, focusedGovernorateId, selectedDistrict, selectedGovernorate]);

  useEffect(()=>{
    if(!initialDistrictId){appliedDistrict.current=null;setSelectedDistrict(null);return;}
    if(!data || !initialDistrictId || appliedDistrict.current===initialDistrictId)return;
    appliedDistrict.current=initialDistrictId;
    const district=data.districts.find(item=>item.id===initialDistrictId);
    if(district)selectDistrict(district);
  },[data,initialDistrictId,selectDistrict]);

  const goBack = useCallback(() => {
    if (selectedDistrict && selectedGovernorate) {
      setSelectedDistrict(null);
      fitBounds(selectedGovernorate.bounds, 0.12);
      onGovernorateChange?.(selectedGovernorate.id);
      return;
    }
    resetMap();
  }, [fitBounds, resetMap, selectedDistrict, selectedGovernorate,onGovernorateChange]);

  const mapReady = Boolean(data && viewBox);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const measure = () => { const rect = svg.getBoundingClientRect(); if (rect.width && rect.height) setCanvasSize({width: rect.width, height: rect.height}); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [mapReady]);

  const zoom = useCallback((factor) => {
    setViewBox(current => {
      if (!current) return current;
      return zoomViewBox(current, factor, {x: current.x + current.width / 2, y: current.y + current.height / 2});
    });
  }, []);

  const handleSearchSelect = (item) => {
    setQuery('');
    if (item.type === 'district') selectDistrict(item);
    else selectGovernorate(item);
  };

  const handleWheel = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return;
    event.preventDefault();
    setViewBox(current => {
      if (!current) return current;
      const anchor = screenToSvgPoint(svg, event, current);
      return zoomViewBox(current, event.deltaY > 0 ? 1.14 : 0.88, anchor);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, {passive: false});
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [data, handleWheel]);

  const getRegionTarget = useCallback((target) => {
    const node = target?.closest?.('[data-region-type][data-region-id]');
    if (!node) return null;
    return {type: node.dataset.regionType, id: node.dataset.regionId};
  }, []);

  const selectRegionTarget = useCallback((target) => {
    if (!target || !data) return;
    if (target.type === 'district') {
      const district = data.districts.find(item => item.id === target.id);
      if (district) selectDistrict(district);
      return;
    }
    const governorate = data.governorates.find(item => item.id === target.id);
    if (governorate) selectGovernorate(governorate);
  }, [data, selectDistrict, selectGovernorate]);

  const handlePointerDown = event => {
    if (!svgRef.current || !viewBox || (event.pointerType === 'mouse' && event.button !== 0)) return;
    svgRef.current.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pointers.current.size === 1) {
      gesture.current = {
        type: 'pan',
        start: {x: event.clientX, y: event.clientY},
        target: getRegionTarget(event.target),
        moved: false,
        viewBox,
      };
    } else if (pointers.current.size === 2) {
      const points = [...pointers.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      gesture.current = {type: 'pinch', distance, viewBox};
    }
  };

  const handlePointerMove = event => {
    if (!svgRef.current || !gesture.current || !viewBox || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
    const rect = svgRef.current.getBoundingClientRect();
    if (gesture.current.type === 'pan' && pointers.current.size === 1) {
      const dx = event.clientX - gesture.current.start.x;
      const dy = event.clientY - gesture.current.start.y;
      if (Math.hypot(dx, dy) > 6) gesture.current.moved = true;
      const scale = Math.min(rect.width / gesture.current.viewBox.width, rect.height / gesture.current.viewBox.height);
      if (!Number.isFinite(scale) || scale <= 0) return;
      setViewBox({
        ...gesture.current.viewBox,
        x: gesture.current.viewBox.x - dx / scale,
        y: gesture.current.viewBox.y - dy / scale,
      });
    }
    if (gesture.current.type === 'pinch' && pointers.current.size >= 2) {
      const points = [...pointers.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const center = {clientX: (points[0].x + points[1].x) / 2, clientY: (points[0].y + points[1].y) / 2};
      const anchor = screenToSvgPoint(svgRef.current, center, gesture.current.viewBox);
      setViewBox(zoomViewBox(gesture.current.viewBox, gesture.current.distance / distance, anchor));
    }
  };

  const handlePointerUp = event => {
    const activeGesture = gesture.current;
    if (event.type !== 'pointercancel' && activeGesture?.type === 'pan' && pointers.current.size === 1) {
      const distance = Math.hypot(event.clientX - activeGesture.start.x, event.clientY - activeGesture.start.y);
      if (!activeGesture.moved && distance <= 6) selectRegionTarget(activeGesture.target);
    }
    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    if (pointers.current.size === 1 && svgRef.current && viewBox) {
      const point = [...pointers.current.values()][0];
      gesture.current = {type: 'pan', start: {x: point.x, y: point.y}, viewBox};
    }
  };

  if (loadError) return <div className="empty-state" role="alert"><h2>تعذر تحميل الخريطة</h2><p>تحقق من الاتصال وأعد المحاولة.</p><button className="btn btn-outline" onClick={()=>setAttempt(value=>value+1)}>إعادة المحاولة</button></div>;
  if (!data || !viewBox) return <div className="ymap-loading" role="status">جارٍ تحميل بيانات الخريطة…</div>;

  const focusedBounds = selectedGovernorate ? selectedGovernorate.bounds : data.country.bounds;
  const labelItems = selectedDistrict ? [selectedDistrict] : selectedGovernorate && viewBox.width < 2.8 ? visibleDistricts : data.governorates;
  const selectedType = selectedDistrict ? 'district' : selectedGovernorate ? 'governorate' : null;
  const labelSizeScale = {small: 0.75, medium: 1, large: 1.5}[labelSizeMode];
  // Labels were 2.2% of the map's width: about 7 px on a phone, where the small western
  // governorates piled on top of each other. They now keep at least 11 px (districts 10 px) on
  // screen, and a name that would overlap a more important one waits for the reader to zoom in.
  const pixelsPerUnit = canvasSize ? Math.min(canvasSize.width / viewBox.width, canvasSize.height / viewBox.height) : 0;
  const atLeast = (size, pixels) => pixelsPerUnit ? Math.max(size, pixels * labelSizeScale / pixelsPerUnit) : size;
  const governorateLabelSize = Math.min(0.48, Math.max(0.018, atLeast(viewBox.width * 0.022 * labelSizeScale, 11)));
  const districtLabelSize = Math.min(0.2, Math.max(0.007, atLeast(viewBox.width * 0.022 * labelSizeScale, 10)));
  const shownLabels = visibleLabelIds(labelItems, {sizeOf: item => item.governorateId ? districtLabelSize : governorateLabelSize,
    pinned: [selectedDistrict?.id, selectedGovernorate?.id, hovered].filter(Boolean), important: MAIN_CITIES});
  const labelStrokeWidth = Math.min(0.055, Math.max(0.0008, viewBox.width * 0.0023 * Math.sqrt(labelSizeScale)));

  return <div className="ymap-app">
    <div className="ymap-toolbar">
      <MapSearch
        query={query}
        setQuery={setQuery}
        governorates={data.governorates}
        selectedGovernorateId={selectedGovernorate?.id || ''}
        results={searchResults}
        onSelect={handleSearchSelect}
        onGovernoratePick={selectGovernorate}
      />
      <MapControls
        canBack={Boolean(selectedGovernorate)}
        labelsVisible={labelsVisible}
        labelSizeMode={labelSizeMode}
        districtsVisible={districtsVisible}
        onBack={goBack}
        onReset={resetMap}
        onZoomIn={() => zoom(0.8)}
        onZoomOut={() => zoom(1.2)}
        onToggleLabels={() => setLabelsVisible(value => !value)}
        onLabelSizeChange={setLabelSizeMode}
        onToggleDistricts={() => setDistrictsVisible(value => !value)}
      />
    </div>

    <div className="ymap-stage">
      <div className="ymap-canvas" ref={canvasRef}>
        <svg
          ref={svgRef}
          viewBox={viewBoxToString(viewBox)}
          role="group"
          aria-label="خريطة تفاعلية لليمن"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <path className="ymap-country" d={geometryToPath(data.country.geometry)}/>
          {data.governorates.map(item => <path
            key={item.id}
            data-region-type="governorate"
            data-region-id={item.id}
            tabIndex={0}
            role="button"
            aria-label={'استكشاف محافظة ' + item.nameAr}
            aria-pressed={selectedGovernorate?.id === item.id}
            onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectGovernorate(item);}}}
            d={geometryToPath(item.geometry)}
            className={[
              'ymap-governorate',
              hovered === item.id ? 'hovered' : '',
              selectedGovernorate?.id === item.id ? 'selected' : '',
            ].join(' ')}
            onPointerEnter={() => setHovered(item.id)}
            onPointerLeave={() => setHovered(null)}
          >
            <title>{item.nameAr}</title>
          </path>)}
          {visibleDistricts.map(item => <path
            key={item.id}
            data-region-type="district"
            data-region-id={item.id}
            tabIndex={0}
            role="button"
            aria-label={'استكشاف مديرية ' + item.nameAr}
            aria-pressed={selectedDistrict?.id === item.id}
            onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectDistrict(item);}}}
            d={geometryToPath(item.geometry)}
            className={[
              'ymap-district',
              hovered === item.id ? 'hovered' : '',
              selectedDistrict?.id === item.id ? 'selected' : '',
            ].join(' ')}
            onPointerEnter={() => setHovered(item.id)}
            onPointerLeave={() => setHovered(null)}
          >
            <title>{item.nameAr}</title>
          </path>)}
          {labelsVisible && labelItems.filter(item => shownLabels.has(item.id)).map(item => {
            const isDistrict = Boolean(item.governorateId);
            const labelType = isDistrict ? 'district' : 'governorate';
            const isSelected = isDistrict ? selectedDistrict?.id === item.id : selectedGovernorate?.id === item.id;
            return <text
              key={'label-' + item.id}
              data-region-type={labelType}
              data-region-id={item.id}
              className={[
                'ymap-label',
                isDistrict ? 'ymap-label-district' : '',
                hovered === item.id ? 'hovered' : '',
                isSelected ? 'selected' : '',
              ].join(' ')}
              x={item.center[0]}
              y={-item.center[1]}
              style={{
                fontSize: `${isDistrict ? districtLabelSize : governorateLabelSize}px`,
                strokeWidth: `${labelStrokeWidth}px`,
              }}
              onPointerEnter={() => setHovered(item.id)}
              onPointerLeave={() => setHovered(null)}
            >
              <title>{item.nameAr}</title>
              {item.nameAr}
            </text>;
          })}
        </svg>
        <div className="ymap-coordinate-note">اسحب الخريطة للتحريك، واستخدم عجلة الماوس أو الأزرار للتكبير.</div>
        <MapLegend source={data.source}/>
      </div>

      <RegionInfoPanel
        profileError={profileError}
        showFigures={showFigures}
        country={data.country}
        region={selectedRegion}
        regionType={selectedType}
        districts={data.districts}
        profiles={profiles}
        source={data.source}
        onClose={resetMap}
        onDistrictSelect={selectDistrict}
        onGovernorateBack={() => {
          if (selectedGovernorate) {
            setSelectedDistrict(null);
            fitBounds(selectedGovernorate.bounds, 0.12);
          }
        }}
      />
    </div>

    <details className="ymap-data-note"><summary>مصدر الحدود: OCHA / HDX · التفاصيل</summary><p>حدود إدارية من مجموعة COD-AB لليمن. تظهر المعلومات النصية عند توفرها، والحقول الناقصة موسومة بوضوح.</p><span>نطاق العرض الحالي: {focusedBounds.map(value => value.toFixed(2)).join(' / ')}</span></details>
  </div>;
}
