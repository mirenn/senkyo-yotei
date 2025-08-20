import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, candidateService, userService } from '../firebase/services';
import { type Election, type Candidate } from '../types';

const EditElection = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [electionData, setElectionData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  
  const [candidates, setCandidates] = useState<Omit<Candidate, 'id' | 'electionId' | 'createdAt'>[]>([]);
  const [existingCandidates, setExistingCandidates] = useState<Candidate[]>([]);
  const [election, setElection] = useState<Election | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load election data and check permissions
  useEffect(() => {
    const loadElectionData = async () => {
      if (!id || !state.user) return;

      try {
        const [electionData, candidatesData, userData] = await Promise.all([
          electionService.getElection(id),
          candidateService.getCandidates(id),
          userService.getUser(state.user.uid)
        ]);

        if (!electionData) {
          navigate('/elections');
          return;
        }

        // Check if user can edit this election (creator or admin)
        const canEdit = electionData.createdBy === state.user.uid || userData?.isAdmin;
        if (!canEdit) {
          navigate('/elections');
          return;
        }

        setElection(electionData);
        
        // Format dates for input fields
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        setElectionData({
          title: electionData.title,
          description: electionData.description,
          startDate: formatDate(electionData.startDate),
          endDate: formatDate(electionData.endDate),
        });

        setExistingCandidates(candidatesData);
        setCandidates(candidatesData.map(c => ({
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl || '',
        })));

      } catch (error) {
        console.error('Error loading election data:', error);
        navigate('/elections');
      } finally {
        setInitialLoading(false);
      }
    };

    loadElectionData();
  }, [id, state.user, navigate]);

  // Redirect if not authenticated
  if (!state.user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">選挙を編集するにはログインが必要です</p>
        <button
          onClick={() => navigate('/elections')}
          className="text-blue-600 hover:underline"
        >
          選挙一覧に戻る
        </button>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">選挙データを読み込み中...</p>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">選挙が見つかりません</p>
        <button
          onClick={() => navigate('/elections')}
          className="text-blue-600 hover:underline"
        >
          選挙一覧に戻る
        </button>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setElectionData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCandidateChange = (index: number, field: keyof typeof candidates[0], value: string) => {
    setCandidates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    
    // Clear error when user starts typing
    const errorKey = `candidate_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addCandidate = () => {
    setCandidates(prev => [...prev, { name: '', description: '', imageUrl: '' }]);
  };

  const removeCandidate = (index: number) => {
    if (candidates.length > 2) {
      setCandidates(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate election data
    if (!electionData.title.trim()) {
      newErrors.title = 'タイトルは必須です';
    }
    if (!electionData.description.trim()) {
      newErrors.description = '説明は必須です';
    }
    if (!electionData.startDate) {
      newErrors.startDate = '開始日は必須です';
    }
    if (!electionData.endDate) {
      newErrors.endDate = '終了日は必須です';
    }

    // Check date order
    if (electionData.startDate && electionData.endDate) {
      if (new Date(electionData.startDate) >= new Date(electionData.endDate)) {
        newErrors.endDate = '終了日は開始日より後である必要があります';
      }
    }

    // Validate candidates
    candidates.forEach((candidate, index) => {
      if (!candidate.name.trim()) {
        newErrors[`candidate_${index}_name`] = '候補者名は必須です';
      }
      if (!candidate.description.trim()) {
        newErrors[`candidate_${index}_description`] = '候補者の説明は必須です';
      }
    });

    // Check for duplicate candidate names
    const names = candidates.map(c => c.name.trim().toLowerCase()).filter(Boolean);
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      candidates.forEach((candidate, index) => {
        if (duplicateNames.includes(candidate.name.trim().toLowerCase())) {
          newErrors[`candidate_${index}_name`] = '候補者名が重複しています';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !election) {
      return;
    }

    setLoading(true);
    
    try {
      console.log('Starting election update process...');
      
      const updates: Partial<Omit<Election, 'id' | 'createdAt'>> = {
        title: electionData.title.trim(),
        description: electionData.description.trim(),
        startDate: new Date(electionData.startDate),
        endDate: new Date(electionData.endDate),
        updatedAt: new Date(),
      };

      console.log('Election updates prepared:', updates);

      // Update election
      await electionService.updateElection(election.id, updates);
      console.log('Election updated successfully');

      // Update candidates
      const candidatesToUpdate = candidates.map((candidate, index) => ({
        name: candidate.name.trim(),
        description: candidate.description.trim(),
        imageUrl: candidate.imageUrl || '',
        electionId: election.id,
        id: existingCandidates[index]?.id || `temp_${index}`, // Use existing ID or temporary for new candidates
        createdAt: existingCandidates[index]?.createdAt || new Date(),
      }));

      await candidateService.updateElectionCandidates(election.id, candidatesToUpdate);
      console.log('Candidates updated successfully');

      alert('選挙が正常に更新されました');
      navigate(`/elections/${election.id}`);
      
    } catch (error: any) {
      console.error('Error updating election:', error);
      alert(`選挙の更新に失敗しました: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">選挙を編集</h1>
        <button
          onClick={() => navigate(`/elections/${election.id}`)}
          className="text-gray-600 hover:text-gray-800"
        >
          ← 戻る
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Election Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">基本情報</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                タイトル *
              </label>
              <input
                type="text"
                id="title"
                value={electionData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="選挙のタイトルを入力"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                説明 *
              </label>
              <textarea
                id="description"
                value={electionData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="選挙の詳細説明を入力"
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  開始日時 *
                </label>
                <input
                  type="datetime-local"
                  id="startDate"
                  value={electionData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    errors.startDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>}
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  終了日時 *
                </label>
                <input
                  type="datetime-local"
                  id="endDate"
                  value={electionData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Candidates */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">候補者 ({candidates.length}名)</h2>
            <button
              type="button"
              onClick={addCandidate}
              className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              + 候補者を追加
            </button>
          </div>

          <div className="space-y-4">
            {candidates.map((candidate, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium text-gray-900">候補者 {index + 1}</h3>
                  {candidates.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      削除
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名前 *
                    </label>
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`candidate_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="候補者の名前"
                    />
                    {errors[`candidate_${index}_name`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`candidate_${index}_name`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      説明 *
                    </label>
                    <textarea
                      value={candidate.description}
                      onChange={(e) => handleCandidateChange(index, 'description', e.target.value)}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`candidate_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="候補者の経歴、政策など"
                    />
                    {errors[`candidate_${index}_description`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`candidate_${index}_description`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      画像URL（任意）
                    </label>
                    <input
                      type="url"
                      value={candidate.imageUrl}
                      onChange={(e) => handleCandidateChange(index, 'imageUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(`/elections/${election.id}`)}
            className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditElection;