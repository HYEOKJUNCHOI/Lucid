import { useState, useEffect, useRef, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { getCachedWord, cacheWord, updateCachedWord } from '../../services/dictionaryService';
import { getApiKey } from '../../lib/apiKey';
import { MODELS, OPENAI_CHAT_URL } from '../../lib/aiConfig';

// 프로그래밍 키워드 로컬 사전
// { ko: 코딩에서의 뜻, en: 영어 단어 자체의 한국어 본뜻, desc: 설명 }
const PROG_KEYWORDS = {
  // ─── 제어문 ───
  while:       { ko: '~하는 동안 반복',    en: '~하는 동안, 잠시',          desc: '조건이 참인 동안 코드 블록을 계속 실행하는 반복문' },
  for:         { ko: '반복문',             en: '~을 위해, ~동안',           desc: '초기값·조건·증감식을 한 줄에 작성하는 반복문' },
  if:          { ko: '조건문',             en: '만약, ~이라면',             desc: '조건이 참일 때만 코드 블록을 실행' },
  else:        { ko: '아니면',             en: '그렇지 않으면, 그 외에',     desc: 'if 조건이 거짓일 때 실행되는 블록' },
  switch:      { ko: '분기문',             en: '전환하다, 바꾸다',           desc: '값에 따라 여러 경우(case)로 분기하는 제어문' },
  case:        { ko: '경우',               en: '경우, 사례',                desc: 'switch 문에서 특정 값과 일치할 때 실행할 블록' },
  break:       { ko: '중단',               en: '부수다, 멈추다, 휴식',       desc: '반복문이나 switch 문을 즉시 빠져나가는 명령' },
  continue:    { ko: '건너뛰기',            en: '계속하다, 이어나가다',       desc: '현재 반복을 건너뛰고 다음 반복으로 넘어가는 명령' },
  return:      { ko: '반환',               en: '돌아가다, 돌려주다',         desc: '함수를 종료하고 값을 호출한 곳으로 돌려보내는 명령' },
  // ─── 변수/타입 선언 ───
  var:         { ko: '변수 선언 (구식)',    en: '변수 (variable의 줄임)',     desc: '함수 스코프를 가지는 변수 선언 키워드. ES6 이전 방식' },
  let:         { ko: '변수 선언',          en: '허용하다, ~하게 하다',       desc: '블록 스코프를 가지는 변수. 값 변경 가능' },
  const:       { ko: '상수 선언',          en: '상수 (constant의 줄임)',     desc: '블록 스코프를 가지며 재할당 불가능한 상수' },
  int:         { ko: '정수형',             en: '정수 (integer의 줄임)',      desc: '소수점 없는 정수를 저장하는 자료형. Java 기본 타입' },
  double:      { ko: '실수형 (64비트)',     en: '두 배의, 이중의',            desc: '소수점 포함 실수. float보다 정밀도 높음' },
  float:       { ko: '실수형 (32비트)',     en: '떠다니다, 부유하다',         desc: '소수점 포함 실수. double보다 정밀도 낮고 메모리 적음' },
  long:        { ko: '큰 정수형',           en: '긴, 오랜',                  desc: 'int보다 큰 범위의 정수를 저장하는 자료형' },
  char:        { ko: '문자형 (1글자)',      en: '문자 (character의 줄임)',    desc: '글자 한 개를 저장하는 자료형. 작은따옴표로 표현' },
  byte:        { ko: '바이트형',            en: '한 입, 8비트 단위',          desc: '1바이트 크기의 정수형. 파일·네트워크 데이터 처리에 자주 사용' },
  boolean:     { ko: '참/거짓 타입',        en: '불 대수 (수학자 Boole의 이름)', desc: 'true 또는 false 두 가지 값만 가지는 논리 타입' },
  string:      { ko: '문자열',             en: '끈, 실, 줄',                 desc: '텍스트 데이터를 나타내는 타입. 따옴표로 감쌈' },
  number:      { ko: '숫자 타입 (JS)',      en: '숫자, 번호',                 desc: '정수·소수를 모두 포함하는 숫자 타입' },
  void:        { ko: '반환값 없음',         en: '빈, 공허한, 없는',           desc: '함수가 아무 값도 반환하지 않음을 나타내는 타입' },
  // ─── 함수/클래스 선언 ───
  function:    { ko: '함수',               en: '기능, 역할, 함수',           desc: '재사용 가능한 코드 블록을 정의하는 키워드' },
  class:       { ko: '클래스',             en: '수업, 등급, 계층',           desc: '객체를 만들기 위한 설계도(청사진)를 정의하는 키워드' },
  interface:   { ko: '인터페이스',          en: '접점, 경계면, 연결부',       desc: '클래스가 반드시 구현해야 할 메서드의 목록을 정의' },
  enum:        { ko: '열거형',             en: '열거 (enumeration의 줄임)',  desc: '미리 정해진 상수들의 집합. 요일·상태 코드 등에 활용' },
  // ─── OOP ───
  extends:     { ko: '상속',               en: '확장하다, 늘이다, 뻗다',     desc: '부모 클래스의 속성과 메서드를 자식 클래스가 이어받는 키워드' },
  implements:  { ko: '구현',               en: '실행하다, 이행하다',         desc: '인터페이스에 정의된 메서드를 클래스에서 실제로 작성하는 키워드' },
  new:         { ko: '인스턴스 생성',       en: '새로운',                    desc: '클래스나 생성자 함수로부터 새 객체를 만드는 키워드' },
  this:        { ko: '현재 객체',           en: '이것, 이',                  desc: '현재 실행 중인 객체 자신을 가리키는 키워드' },
  super:       { ko: '부모 클래스 참조',    en: '위의, 초월한, 최고의',       desc: '상속받은 부모 클래스의 생성자나 메서드를 호출하는 키워드' },
  static:      { ko: '정적 (공유)',         en: '고정된, 움직이지 않는',      desc: '인스턴스 생성 없이 클래스 자체에서 직접 호출 가능한 멤버' },
  abstract:    { ko: '추상 (미완성)',       en: '추상적인, 요약',             desc: '직접 인스턴스화 불가. 반드시 자식 클래스에서 구현해야 함' },
  final:       { ko: '변경 불가',          en: '마지막의, 최종의',           desc: '변수는 재할당 불가, 메서드는 오버라이드 불가, 클래스는 상속 불가' },
  override:    { ko: '재정의',             en: '무시하다, 덮어쓰다',         desc: '부모 클래스의 메서드를 자식 클래스에서 다시 구현하는 것' },
  overload:    { ko: '중복 정의',          en: '과부하, 너무 많이 싣다',      desc: '같은 이름의 메서드를 매개변수 타입·개수를 달리하여 여러 개 정의' },
  // ─── 접근 제어자 ───
  public:      { ko: '공개',               en: '공공의, 공개된',             desc: '어디서든 접근 가능한 접근 제어자' },
  private:     { ko: '비공개',             en: '개인의, 사적인, 비밀의',     desc: '해당 클래스 내부에서만 접근 가능한 접근 제어자' },
  protected:   { ko: '보호됨',             en: '보호된, 지켜진',             desc: '해당 클래스와 자식 클래스에서만 접근 가능한 접근 제어자' },
  // ─── 비동기 ───
  async:       { ko: '비동기 함수',         en: '비동기의 (asynchronous 줄임)', desc: '내부에서 await를 사용할 수 있게 해주는 함수 선언 키워드' },
  await:       { ko: '비동기 대기',         en: '기다리다',                   desc: 'Promise가 완료될 때까지 기다리는 키워드. async 함수 내에서만 사용' },
  // ─── 에러 처리 ───
  try:         { ko: '시도',               en: '시도하다, 해보다',           desc: '오류가 발생할 수 있는 코드를 감싸는 블록' },
  catch:       { ko: '오류 잡기',           en: '잡다, 붙잡다',              desc: 'try 블록에서 발생한 오류를 처리하는 블록' },
  finally:     { ko: '최종 실행',           en: '마침내, 결국',              desc: '성공·실패 여부와 관계없이 항상 실행되는 블록' },
  throw:       { ko: '예외 던지기',         en: '던지다',                    desc: '오류를 직접 발생시키는 키워드' },
  throws:      { ko: '예외 선언 (Java)',    en: '던진다 (throw의 3인칭)',     desc: 'Java에서 메서드가 던질 수 있는 예외를 선언하는 키워드' },
  // ─── 모듈 ───
  import:      { ko: '가져오기',            en: '수입하다, 가져오다',         desc: '다른 파일의 함수·변수·클래스를 현재 파일로 불러오는 키워드' },
  export:      { ko: '내보내기',            en: '수출하다, 내보내다',         desc: '현재 파일의 코드를 다른 파일에서 사용할 수 있게 공개' },
  // ─── 값 리터럴 ───
  null:        { ko: '빈 값 (의도적)',      en: '없음, 무효, 영(0)',          desc: '값이 없음을 명시적으로 나타내는 키워드' },
  undefined:   { ko: '정의되지 않음',       en: '정의되지 않은, 불명확한',    desc: '변수가 선언됐지만 값이 할당되지 않은 상태' },
  true:        { ko: '참 (Boolean)',        en: '참, 진짜, 맞는',            desc: '불리언 타입의 참 값' },
  false:       { ko: '거짓 (Boolean)',      en: '거짓, 틀린, 가짜',          desc: '불리언 타입의 거짓 값' },
  // ─── 연산자/타입 확인 ───
  typeof:      { ko: '타입 확인',           en: '~의 타입',                  desc: '변수의 데이터 타입을 문자열로 반환하는 연산자' },
  instanceof:  { ko: '인스턴스 확인',       en: '~의 인스턴스인',             desc: '객체가 특정 클래스의 인스턴스인지 확인하는 연산자' },
  // ─── 자료구조/컬렉션 ───
  array:       { ko: '배열',               en: '배열, 정렬, 늘어세우다',     desc: '여러 값을 순서대로 저장하는 자료구조. 인덱스로 접근' },
  object:      { ko: '객체',               en: '물체, 대상, 목적',           desc: '키-값 쌍으로 데이터를 저장하는 자료구조' },
  list:        { ko: '목록 (가변 배열)',     en: '목록, 명단',                 desc: '순서가 있는 가변 크기의 요소 모음. Java의 ArrayList 등' },
  map:         { ko: '키-값 저장소',        en: '지도, 대응시키다',           desc: '키를 통해 값을 빠르게 조회하는 자료구조. Java의 HashMap 등' },
  set:         { ko: '중복 없는 집합',      en: '놓다, 설정하다, 집합',       desc: '중복을 허용하지 않는 요소 모음' },
  stack:       { ko: '스택 (LIFO)',         en: '쌓다, 더미',                 desc: '마지막에 넣은 것을 먼저 꺼내는 자료구조 (접시 쌓기)' },
  queue:       { ko: '큐 (FIFO)',           en: '줄, 대기열',                 desc: '먼저 넣은 것을 먼저 꺼내는 자료구조 (줄 서기)' },
  // ─── 배열 고차함수 ───
  filter:      { ko: '필터링',             en: '거르다, 필터',               desc: '조건을 만족하는 요소만 모아 새 배열을 반환' },
  reduce:      { ko: '누적 계산',           en: '줄이다, 감소시키다',         desc: '배열을 순회하며 하나의 값으로 합산·집계하는 함수' },
  // ─── 비동기 객체 ───
  callback:    { ko: '콜백 함수',           en: '다시 전화하다, 회신',        desc: '다른 함수에 인수로 전달되어 나중에 실행되는 함수' },
  promise:     { ko: '비동기 처리 객체',    en: '약속',                       desc: '비동기 작업의 완료·실패를 다루는 객체. then/catch로 결과 처리' },
  // ─── Java 시스템 ───
  system:      { ko: '시스템 클래스 (Java)', en: '체계, 시스템, 조직',        desc: '자바에서 표준 입출력, 시스템 속성 등을 다루는 내장 클래스' },
  out:         { ko: '표준 출력 스트림',    en: '밖으로, 나가다',             desc: 'System.out 형태로 사용. 콘솔에 데이터를 출력하는 스트림 객체' },
  println:     { ko: '줄바꿈 출력',         en: '한 줄 출력 (print + line)',  desc: '콘솔에 값을 출력하고 줄을 바꾸는 메서드. System.out.println() 형태로 사용' },
  print:       { ko: '출력 (줄바꿈 없음)',  en: '인쇄하다, 출력하다',         desc: '콘솔에 값을 출력하되 줄을 바꾸지 않는 메서드' },
  scanner:     { ko: '입력 도구 (Java)',    en: '검사기, 스캐너',             desc: '콘솔에서 사용자 입력을 받는 Java 내장 클래스' },
  // ─── 주요 개념 ───
  index:       { ko: '인덱스 (위치)',       en: '색인, 목차, 지수',           desc: '배열에서 요소의 위치를 나타내는 숫자. 0부터 시작' },
  scope:       { ko: '유효 범위',           en: '범위, 영역, 시야',           desc: '변수나 함수에 접근할 수 있는 코드의 유효 범위' },
  closure:     { ko: '클로저',             en: '닫음, 폐쇄, 마감',           desc: '함수가 선언될 때의 외부 변수를 기억해 나중에도 접근할 수 있는 특성' },
  recursion:   { ko: '재귀',               en: '되돌아감, 반복 귀환',        desc: '함수가 자기 자신을 다시 호출하는 방식' },
  iterator:    { ko: '반복자',             en: '반복하는 것',                desc: '컬렉션의 요소를 하나씩 순회할 수 있게 해주는 객체' },
  exception:   { ko: '예외 (오류)',         en: '예외, 이례, 제외',           desc: '프로그램 실행 중 발생하는 비정상적인 상황. try-catch로 처리' },
  instance:    { ko: '인스턴스 (실체)',     en: '사례, 예시, 경우',           desc: '클래스(설계도)로부터 실제로 만들어진 객체' },
  constructor: { ko: '생성자',             en: '건설자, 만드는 것',          desc: 'new 키워드로 객체를 생성할 때 자동으로 호출되는 초기화 메서드' },
  getter:      { ko: '값 읽기 메서드',      en: '가져오는 것 (get + er)',     desc: 'private 필드의 값을 외부에서 읽을 수 있게 해주는 메서드. get으로 시작' },
  setter:      { ko: '값 쓰기 메서드',      en: '설정하는 것 (set + er)',     desc: 'private 필드의 값을 외부에서 변경할 수 있게 해주는 메서드. set으로 시작' },
  render:      { ko: '화면에 그리기',       en: '표현하다, 그리다, 만들다',   desc: '컴포넌트나 화면 요소를 실제로 그려서 보여주는 과정' },
  state:       { ko: '상태 (변하는 데이터)', en: '상태, 국가, 말하다',        desc: '시간이 지나면서 변할 수 있는 데이터. 변경 시 화면이 다시 그려짐' },
  hook:        { ko: '훅 (React)',          en: '갈고리, 걸다, 낚아채다',     desc: 'React에서 함수형 컴포넌트에서도 상태·생명주기를 사용할 수 있게 해주는 함수' },
  component:   { ko: '컴포넌트',           en: '구성 요소, 부품',            desc: '독립적으로 재사용 가능한 UI 조각. React/Vue 등에서 화면을 구성하는 단위' },
  // ─── 약어 ───
  args:        { ko: '인수 목록',           en: '인수들 (arguments 줄임)',    desc: 'arguments의 줄임말. 함수에 전달된 값들의 묶음' },
  params:      { ko: '매개변수',            en: '매개변수들 (parameters 줄임)', desc: 'parameters의 줄임말. 함수가 받아서 사용할 값의 이름' },
  props:       { ko: '속성 (React)',        en: '소품, 속성들 (properties 줄임)', desc: 'properties의 줄임말. 부모 컴포넌트가 자식에게 전달하는 값' },
  dto:         { ko: '데이터 전송 객체',    en: 'Data Transfer Object (데이터 전송 객체)', desc: '계층 간 데이터를 담아 전달하는 단순 객체' },
  api:         { ko: '프로그래밍 인터페이스', en: 'Application Programming Interface (응용 프로그램 인터페이스)', desc: '서버·라이브러리와 통신하는 규약' },
  crud:        { ko: '기본 데이터 처리',    en: 'Create·Read·Update·Delete (생성·읽기·수정·삭제)', desc: '데이터의 4가지 기본 조작' },
  http:        { ko: '웹 통신 프로토콜',    en: 'HyperText Transfer Protocol (하이퍼텍스트 전송 규약)', desc: '브라우저와 서버가 데이터를 주고받는 규약' },
  https:       { ko: '보안 웹 통신',        en: 'HTTP + Secure (보안이 추가된 HTTP)',  desc: 'HTTP에 SSL 암호화를 적용한 보안 통신 프로토콜' },
  json:        { ko: '데이터 교환 형식',    en: 'JavaScript Object Notation (자바스크립트 객체 표기법)', desc: '키-값 쌍으로 이루어진 텍스트 기반 데이터 형식' },
  xml:         { ko: '마크업 데이터 형식',  en: 'eXtensible Markup Language (확장 가능한 마크업 언어)', desc: '태그로 구조화된 데이터 형식. JSON 이전에 많이 사용됨' },
  sql:         { ko: 'DB 질의 언어',        en: 'Structured Query Language (구조화된 질의 언어)', desc: '관계형 DB에서 데이터를 조회·수정하는 언어' },
  mvc:         { ko: '아키텍처 패턴',       en: 'Model-View-Controller (모델·뷰·컨트롤러)', desc: '코드를 데이터·화면·제어 로직으로 분리하는 구조' },
  jsx:         { ko: 'React 문법 확장',     en: 'JavaScript XML (자바스크립트 + XML)',  desc: 'JavaScript 안에서 HTML처럼 UI를 작성할 수 있는 문법' },
  dom:         { ko: '문서 객체 모델',      en: 'Document Object Model (문서 객체 모델)', desc: '브라우저가 HTML을 트리 구조로 표현한 것' },
  // ─── 네트워크/백엔드 ───
  endpoint:    { ko: '엔드포인트 (경로)',   en: '끝점, 종착점',               desc: 'API에서 특정 기능을 수행하는 URL 경로. 예: /api/users' },
  request:     { ko: '요청',               en: '요청하다, 부탁하다',          desc: '클라이언트가 서버에 데이터를 요청하거나 전송하는 행위' },
  response:    { ko: '응답',               en: '응답하다, 대답하다',          desc: '서버가 클라이언트의 요청에 보내는 데이터' },
  token:       { ko: '인증 토큰',           en: '표시, 징표, 증거',            desc: '로그인 후 발급되는 인증 문자열. 요청 시 함께 보내 신원을 증명' },
  payload:     { ko: '전송 데이터 본문',    en: '탑재물, 화물, 실제 내용물',   desc: 'HTTP 요청/응답에서 실제로 주고받는 데이터 본문' },
  // ─── 개발 프로세스 ───
  log:         { ko: '로그 출력',           en: '통나무, 기록하다',            desc: 'console.log() 형태로 사용. 개발 중 값 확인을 위해 콘솔에 출력' },
  debug:       { ko: '디버깅',             en: '벌레(버그) 잡기',             desc: '코드의 오류를 찾고 수정하는 과정. 브레이크포인트로 단계별 실행' },
  build:       { ko: '빌드',               en: '짓다, 건축하다',              desc: '소스 코드를 실행 가능한 형태로 변환하는 과정' },
  deploy:      { ko: '배포',               en: '배치하다, 전개하다',           desc: '완성된 애플리케이션을 실제 서버에 올려 사용자가 접근할 수 있게 하는 과정' },
  compile:     { ko: '컴파일',             en: '모으다, 편집하다',             desc: '사람이 작성한 코드를 컴퓨터가 실행할 수 있는 형태로 변환하는 과정' },
  refactor:    { ko: '리팩토링',            en: '재구성하다, 다시 만들다',     desc: '동작은 유지하면서 코드를 더 읽기 좋고 유지보수하기 쉽게 개선하는 것' },
};

// 세션 메모리 캐시 — 새로고침 전까지 유지, Firebase 재호출 방지
const memoryCache = {};

/**
 * 전역 사전 팝업
 * 영어 단어 더블클릭 → 팝업 (로컬 키워드 → 메모리 → Firebase → API → GPT)
 */
const DictionaryPopup = () => {
  const [popup, setPopup] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const popupRef = useRef(null);

  // 수정 UI 상태 (closeWithReset에서 참조하므로 앞에 선언)
  const [editing, setEditing]           = useState(false);
  const [editKo, setEditKo]             = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editEn, setEditEn]             = useState('');
  const [editLoading, setEditLoading]   = useState(false);
  const [editFeedback, setEditFeedback] = useState(null);

  const close = useCallback(() => {
    setPopup(null);
    setResult(null);
    setError(null);
  }, []);

  const closeWithReset = useCallback(() => {
    setEditing(false);
    setEditFeedback(null);
    setPopup(null);
    setResult(null);
    setError(null);
  }, []);

  // 트리플 클릭 감지
  useEffect(() => {
    const getWordAt = (node, offset) => {
      if (!node || node.nodeType !== Node.TEXT_NODE) return '';
      const text = node.textContent || '';
      let start = offset;
      let end = offset;
      while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
      while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;
      return text.slice(start, end);
    };

    const handleDblClick = (e) => {
      if (e.detail !== 2 || !e.altKey) return; // Alt + 더블클릭만
      // 학습 페이지(/home, /freestudy)에서만 동작
      const { pathname } = window.location;
      if (!pathname.startsWith('/home') && pathname !== '/freestudy') return;

      let word = '';
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) word = getWordAt(range.startContainer, range.startOffset);
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) word = getWordAt(pos.offsetNode, pos.offset);
      }
      if (!word) word = window.getSelection()?.toString().trim() || '';
      word = word.replace(/[^a-zA-Z'-]/g, '').trim();
      if (!word || word.length < 2 || !/^[a-zA-Z]/.test(word)) { close(); return; }

      const POPUP_W = 296;
      const POPUP_H = 240; // 팝업 대략 높이
      const MARGIN  = 12;

      const x = Math.max(MARGIN, Math.min(e.clientX, window.innerWidth - POPUP_W - MARGIN));
      const spaceBelow = window.innerHeight - e.clientY;
      const y = spaceBelow < POPUP_H + 32
        ? e.clientY - POPUP_H - 8   // 아래 공간 부족 → 위로
        : e.clientY + 24;            // 기본: 아래로

      setPopup({ word, x, y });
    };

    window.addEventListener('click', handleDblClick);
    return () => window.removeEventListener('click', handleDblClick);
  }, [close]);

  // 외부 클릭 / ESC 닫기
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeWithReset(); };
    const handleMouseDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) closeWithReset();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [closeWithReset]);


  // 세션 메모리 캐시 (컴포넌트 외부 — 탭 새로고침 전까지 유지)
  // 단어 조회 (로컬 → 메모리 → Firebase → API → GPT)
  useEffect(() => {
    if (!popup?.word) return;
    const word = popup.word.toLowerCase();

    // 발음 기호 백그라운드 fetch 헬퍼
    const fetchPhonetic = (w) => {
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          const entry = data[0];
          const phonetic = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || null;
          const audio = entry?.phonetics?.find(p => p.audio)?.audio || null;
          if (phonetic || audio) {
            setResult(prev => prev ? { ...prev, phonetic, audio } : prev);
          }
        })
        .catch(() => {});
    };

    // 1순위: 로컬 키워드 사전 (즉시 표시 → 백그라운드에서 수정본 확인)
    if (PROG_KEYWORDS[word]) {
      setResult({ word: popup.word, type: 'prog', cached: false, ...PROG_KEYWORDS[word] });
      setLoading(false);
      fetchPhonetic(word);
      // 백그라운드: Firebase에 수정본(editedAt != null)이 있으면 교체
      getCachedWord(word).then(cached => {
        if (cached?.editedAt) {
          memoryCache[word] = { cached: true, ...cached };
          setResult(prev => prev ? { word: popup.word, cached: true, ...cached } : prev);
        }
      }).catch(() => {});
      return;
    }

    // 2순위: 세션 메모리 캐시 (즉시)
    if (memoryCache[word]) {
      setResult({ word: popup.word, ...memoryCache[word] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setEditing(false);
    setEditFeedback(null);

    const callGPT = async (prompt, maxTokens = 150) => {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.CHAT,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: maxTokens,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || '';
    };

    const fetchAll = async () => {
      try {
        // Firebase 캐시 확인
        const cached = await getCachedWord(word);
        if (cached) {
          memoryCache[word] = { cached: true, ...cached };
          setResult({ word: popup.word, cached: true, ...cached });
          if (!cached.phonetic) fetchPhonetic(word);
          // 구버전 캐시(enDef 영어만 있고 desc 없음) → 백그라운드 번역 후 업데이트
          if (cached.type === 'dict' && cached.enDef && !cached.desc) {
            fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cached.enDef)}&langpair=en|ko`)
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                const t = d?.responseData?.translatedText;
                if (t && /[가-힣]/.test(t)) {
                  const updated = { ...cached, desc: t };
                  memoryCache[word] = { cached: true, ...updated };
                  updateCachedWord(word, { desc: t }, 'system').catch(() => {});
                  setResult(prev => prev ? { ...prev, desc: t } : prev);
                }
              }).catch(() => {});
          }
          return;
        }

        // 3순위: 영어 사전 + 번역 API
        const [dictRes, transRes] = await Promise.all([
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
          fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`),
        ]);

        const dictData = dictRes.ok ? await dictRes.json() : null;
        const transData = transRes.ok ? await transRes.json() : null;

        const entry = dictData?.[0];
        const phonetic = entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || null;
        const audio = entry?.phonetics?.find(p => p.audio)?.audio || null;
        const enDef = entry?.meanings?.[0]?.definitions?.[0]?.definition || null;
        const partOfSpeech = entry?.meanings?.[0]?.partOfSpeech || null;

        const rawKorean = transData?.responseData?.translatedText || null;
        const hasKorean = rawKorean && /[가-힣]/.test(rawKorean);
        let korean = hasKorean && rawKorean.toLowerCase() !== word && rawKorean.length >= 2 ? rawKorean : null;

        if (!entry && !korean) {
          // 4순위: GPT (코딩 용어) → Firebase 저장
          try {
            const raw = await callGPT(
              `프로그래밍 용어 "${word}"를 아래 JSON 형식으로만 답해줘 (모두 한국어로):\n{"ko":"코딩에서의 뜻 (1~5글자)","en":"이 영어 단어 자체의 원래 한국어 뜻 (예: string→끈·실, catch→잡다)","desc":"코딩에서 역할 1~2문장"}`
            );
            const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
            const data = { type: 'prog', ko: parsed.ko, en: parsed.en, desc: parsed.desc };
            memoryCache[word] = { cached: true, ...data };
            await cacheWord(word, data);
            setResult({ word: popup.word, cached: false, ...data });
            fetchPhonetic(word);
          } catch {
            setResult({ word: popup.word, type: 'noResult', cached: false });
          }
          return;
        }

        // 한국어 없으면 GPT 보충
        if (!korean && entry) {
          try {
            const raw = await callGPT(`"${word}"의 핵심 한국어 뜻을 2~5글자로만 답해줘. 예시: "나가다"`, 30);
            if (raw && /[가-힣]/.test(raw)) korean = raw.replace(/["""]/g, '').trim();
          } catch { /* 무시 */ }
        }

        // enDef(영어) → 한국어 설명으로 번역
        let desc = null;
        if (enDef) {
          try {
            const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enDef)}&langpair=en|ko`);
            const d = r.ok ? await r.json() : null;
            const t = d?.responseData?.translatedText;
            if (t && /[가-힣]/.test(t)) desc = t;
          } catch { /* 무시 */ }
        }
        const data = { type: 'dict', phonetic, audio, korean, desc, partOfSpeech };
        memoryCache[word] = { cached: true, ...data };
        await cacheWord(word, data);
        setResult({ word: popup.word, cached: false, ...data });
      } catch {
        setError('사전을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [popup?.word]);

  // 수정 제출 (GPT 검증 → Firestore 업데이트)
  const handleEditSubmit = async () => {
    if (!editKo.trim() || !editDesc.trim()) return;
    setEditLoading(true);
    setEditFeedback(null);
    const word = popup.word.toLowerCase();
    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODELS.CHAT,
          messages: [{
            role: 'user',
            content: `너는 코딩 사전 검수자야. 제출된 모든 필드가 단어의 실제 의미와 일치하는지 엄격하게 판단해.

단어: "${word}"
한국어 뜻(코딩): ${editKo}
설명: ${editDesc}${editEn.trim() ? `\n영어 본뜻 (영어 단어 자체의 원래 한국어 의미): ${editEn.trim()}` : ''}

[판단 기준 - 명백히 틀린 경우에만 반려, 사소한 표현 차이는 통과]
1. 한국어 뜻이 "${word}"와 관련 있으면 OK (완벽한 표현 불필요)
2. 설명이 "${word}"의 의미를 대략적으로라도 설명하면 OK (한국어·영어 모두 허용, 표현이 완벽하지 않아도 됨)
3. 영어 본뜻이 제출된 경우: 영어 단어 "${word}" 자체의 사전적 의미와 정반대이거나 완전히 무관하면 반려 (예: build→파괴하다, start→멈추다 같은 반의어)
4. 반드시 반려할 것: 반의어, 욕설·비방, 명백한 허위 정보, "${word}"와 전혀 무관한 내용
5. 의심스럽지만 완전히 틀리진 않으면 통과시켜라 (관대하게 판단)

JSON으로만 답해: {"valid": true} 또는 {"valid": false, "reason": "구체적 반려 이유"}`,
          }],
          temperature: 0,
          max_tokens: 80,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (parsed.valid) {
        const uid = auth.currentUser?.uid || 'anonymous';
        const newData = { ...result, ko: editKo.trim(), desc: editDesc.trim(), en: editEn.trim() || result.en };
        await updateCachedWord(word, newData, uid);
        setResult(prev => ({ ...prev, ko: editKo.trim(), desc: editDesc.trim(), en: editEn.trim() || prev.en, cached: true }));
        setEditing(false);
        setEditFeedback({ ok: true, msg: '✅ 수정이 반영되었습니다.' });
        setTimeout(() => setEditFeedback(null), 3000);
      } else {
        setEditFeedback({ ok: false, msg: `❌ 반려: ${parsed.reason || '내용이 정확하지 않습니다.'}` });
      }
    } catch {
      setEditFeedback({ ok: false, msg: '❌ 검증 중 오류가 발생했습니다.' });
    } finally {
      setEditLoading(false);
    }
  };

  const playAudio = () => {
    if (result?.audio) {
      const url = result.audio.startsWith('//') ? `https:${result.audio}` : result.audio;
      new Audio(url).play().catch(() => {});
    }
  };

  if (!popup) return null;

  const style = { position: 'fixed', left: popup.x, top: popup.y, zIndex: 9999 };

  return (
    <div
      ref={popupRef}
      style={style}
      className="w-72 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden text-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-base">{popup.word}</span>
          {result?.type === 'prog' && (
            <span className="text-[9px] text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5 font-bold">
              코딩 키워드
            </span>
          )}
          {result?.phonetic && (
            <span className="text-gray-400 text-xs">{result.phonetic}</span>
          )}
          {result?.audio && (
            <button onClick={playAudio} className="text-cyan-400 hover:text-cyan-300 transition-colors" title="발음 듣기">
              🔊
            </button>
          )}
        </div>
        <button onClick={closeWithReset} className="text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors">×</button>
      </div>

      {/* 본문 */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {loading && (
          <div className="flex items-center justify-center py-4 gap-2 text-gray-500 text-xs">
            <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
            불러오는 중...
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center py-2">{error}</p>}

        {result && !loading && (
          <>
            {/* 편집 폼 */}
            {editing ? (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-yellow-400/70 mb-0.5">GPT가 내용을 검토 후 반영합니다.</p>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500">한국어 뜻</label>
                  <input
                    value={editKo} onChange={e => setEditKo(e.target.value)}
                    className="bg-[#2a2a2a] border border-[#444] rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
                    placeholder="예: 반복문"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500">설명</label>
                  <textarea
                    value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                    className="bg-[#2a2a2a] border border-[#444] rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="코딩에서 어떤 역할인지"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500">영어 본뜻 (선택)</label>
                  <input
                    value={editEn} onChange={e => setEditEn(e.target.value)}
                    className="bg-[#2a2a2a] border border-[#444] rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
                    placeholder="예: Repeats while condition is true"
                  />
                </div>
                {editFeedback && (
                  <p className={`text-[11px] ${editFeedback.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {editFeedback.msg}
                  </p>
                )}
                <div className="flex gap-1.5 mt-0.5">
                  <button
                    onClick={handleEditSubmit}
                    disabled={editLoading || !editKo.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs transition-colors disabled:opacity-40"
                  >
                    {editLoading ? '검증 중...' : '제출'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditFeedback(null); }}
                    className="py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-xs transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 프로그래밍 키워드 / GPT / Firebase 캐시 결과 */}
                {result.type === 'prog' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-gray-500 mt-0.5 shrink-0">뜻</span>
                      <span className="text-emerald-300 font-semibold text-sm">{result.ko}</span>
                    </div>
                    {result.desc && (
                      <p className="text-gray-400 text-xs leading-relaxed border-l-2 border-[#333] pl-2.5">
                        {result.desc}
                      </p>
                    )}
                    {result.en && (
                      <div className="flex items-start gap-2 pt-0.5">
                        <span className="text-[10px] text-gray-500 mt-0.5 shrink-0">본뜻</span>
                        <span className="text-gray-400 text-xs leading-relaxed italic">{result.en}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 일반 영어 사전 */}
                {result.type === 'dict' && (
                  <div className="flex flex-col gap-2">
                    {result.korean && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-500 mt-0.5 shrink-0">뜻</span>
                        <span className="text-violet-300 font-semibold text-sm">{result.korean}</span>
                      </div>
                    )}
                    {result.partOfSpeech && (
                      <span className="self-start text-[9px] text-cyan-500 border border-cyan-500/30 rounded px-1.5 py-0.5 font-bold uppercase">
                        {result.partOfSpeech}
                      </span>
                    )}
                    {result.desc && (
                      <p className="text-gray-400 text-xs leading-relaxed border-l-2 border-[#333] pl-2.5">
                        {result.desc}
                      </p>
                    )}
                  </div>
                )}

                {/* 검색 결과 없음 */}
                {result.type === 'noResult' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-gray-500 text-xs text-center pb-1">사전에 없는 단어입니다.</p>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(result.word)}+프로그래밍+뜻`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-xs text-gray-300 hover:text-white transition-colors"
                    >
                      🔍 Google에서 검색
                    </a>
                    <a
                      href={`https://dict.naver.com/search.dict?dicQuery=${encodeURIComponent(result.word)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-xs text-gray-300 hover:text-white transition-colors"
                    >
                      📖 네이버 사전에서 검색
                    </a>
                  </div>
                )}

                {/* 수정 버튼 (캐시된 결과에만 표시) + 수정 완료 피드백 */}
                {editFeedback?.ok && (
                  <p className="text-emerald-400 text-[11px]">{editFeedback.msg}</p>
                )}
                {result.type !== 'noResult' && (
                  <button
                    onClick={() => {
                      setEditKo(result.ko || result.korean || '');
                      setEditDesc(result.desc || result.enDef || '');
                      setEditEn(result.en || '');
                      setEditing(true);
                    }}
                    className="self-end text-[10px] text-gray-600 hover:text-gray-400 transition-colors mt-1"
                  >
                    ✏️ 수정 제안
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 하단 */}
      <div className="px-4 py-2 border-t border-[#2a2a2a] flex items-center justify-between bg-[#111]">
        <span className="text-[9px] text-gray-600">더블클릭으로 단어 검색</span>
        <span className="text-[9px] text-gray-600">ESC 닫기</span>
      </div>
    </div>
  );
};

export default DictionaryPopup;
